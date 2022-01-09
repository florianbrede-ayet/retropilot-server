const sanitize = require('sanitize')();
const { Op } = require('sequelize');
const crypto = require('crypto');
const dirTree = require('directory-tree');
const config = require('../config');
const authenticationController = require('./authentication');
const orm = require('../models/index.model');
const usersController = require('./users');

async function pairDevice(account, qrString) {
  if (qrString === undefined || qrString === null) {
    return { success: false, badQr: true };
  }
  // Legacy registrations encode QR data as "imei--serial--pairtoken"
  // Versions >= 0.8.3 uses only a pairtoken

  const qrCodeParts = qrString.split('--');
  let deviceQuery;
  let pairJWT;
  if (qrString.indexOf('--') >= 0) {
    const [, serial, pairToken] = qrCodeParts;
    deviceQuery = await orm.models.device.findOne({ where: { serial } });
    pairJWT = pairToken;
  } else {
    const data = await authenticationController.readJWT(qrString);
    if (!data.pair) {
      return { success: false, noPair: true };
    }
    deviceQuery = await orm.models.device.findOne({ where: { dongle_id: data.identity } });
    pairJWT = qrString;
  }

  if (deviceQuery == null || !deviceQuery.dataValues) {
    return { success: false, registered: false };
  }

  const device = deviceQuery.dataValues;
  const decoded = await authenticationController.validateJWT(pairJWT, device.public_key);
  if (decoded == null || !decoded.pair) {
    return { success: false, badToken: true };
  }

  if (device.account_id !== 0) {
    return { success: false, alreadyPaired: true, dongle_id: device.dongle_id };
  }
  return pairDeviceToAccountId(device.dongle_id, account.id);
}

async function pairDeviceToAccountId(dongleId, accountId) {
  await orm.models.device.update(
    { account_id: accountId },
    { where: { dongle_id: dongleId } },
  );

  const check = await orm.models.device.findOne(
    { where: { dongle_id: dongleId, account_id: accountId } },
  );
  if (check.dataValues) {
    return {
      success: true, paired: true, dongle_id: dongleId, account_id: accountId,
    };
  }
  return { success: false, paired: false };
}

async function unpairDevice(account, dongleId) {
  const device = await orm.models.device.getOne(
    { where: { account_id: account.id, dongle_id: dongleId } },
  );

  if (device && device.dataValues) {
    await orm.models.device.update(
      { account_id: 0 },
      { where: { dongle_id: dongleId } },
    );
    return { success: true };
  }
  return { success: false, msg: 'BAD DONGLE', invalidDongle: true };
}

async function setDeviceNickname(account, dongleId, nickname) {
  const device = await orm.models.device.getOne(
    { where: { account_id: account.id, dongle_id: dongleId } },
  );

  const cleanNickname = sanitize.value(nickname, 'string');

  if (device && device.dataValues) {
    await orm.models.device.update(
      { nickname: cleanNickname },
      { where: { dongle_id: dongleId } },
    );
    return { success: true, data: { nickname: cleanNickname } };
  }
  return { success: false, msg: 'BAD DONGLE', invalidDongle: true };
}

async function getDevices(accountId) {
  return orm.models.device.findAll({ where: { account_id: accountId } });
}

async function getDeviceFromDongle(dongleId) {
  const devices = await orm.models.device.findOne({ where: { dongle_id: dongleId } });
  if (!devices || !devices.dataValues) {
    return null;
  }
  return devices.dataValues;
}

async function setIgnoredUploads(dongleId, isIgnored) {
  await orm.models.accounts.update(
    { dongle_id: dongleId },
    { where: { uploads_ignored: isIgnored } },
  );

  // TODO check this change was processed..
  return true;
}

async function getAllDevicesFiltered() {
  return orm.models.device.findAll();
}

async function updateLastPing(deviceId, dongleId) {
  await orm.models.device.update(
    { last_ping: Date.now() },
    { where: { [Op.or]: [{ id: deviceId }, { dongle_id: dongleId }] } },
  );
}

async function isUserAuthorised(accountId, dongleId) {
  if (!accountId || !dongleId) {
    return { success: false, msg: 'bad_data' };
  }

  const account = await usersController.getAccountFromId(accountId);
  if (!account || !account.dataValues) {
    return { success: false, msg: 'bad_account', data: { authorised: false, account_id: accountId } };
  }

  const device = await getDeviceFromDongle(dongleId);
  if (!device) {
    return { success: false, msg: 'bad_device', data: { authorised: false, dongle_id: dongleId } };
  }
  if (device.account_id !== account.id) {
    return { success: false, msg: 'not_authorised', data: { authorised: false, account_id: account.id, dongle_id: device.dongle_id } };
  }

  return {
    success: true,
    data: {
      authorised: true, account_id: account.id, dongle_id: device.dongle_id,
    },
  };
}

async function getOwnersFromDongle(dongleId) {
  const device = await getDeviceFromDongle(dongleId);
  if (!device) {
    return { success: false };
  }
  return { success: true, data: [device.account_id] };
}

async function getDrives(dongleId, includeDeleted, includeMeta) {
  let query = { where: { dongle_id: dongleId } };

  if (!includeDeleted) {
    query = { ...query, where: { ...query.where, is_deleted: false } };
  }
  if (!includeMeta) {
    query = { ...query, attributes: { exclude: ['metadata'] } };
  }

  return orm.models.drives.findAll(query);
}

/*
    TODO: ADD AUTHENTICATION TO ENDPOINTS
*/

async function getCrashlogs(dongleId) {
  const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(dongleId).digest('hex');

  const directoryTree = dirTree(`${config.storagePath}${dongleId}/${dongleIdHash}/crash/`, { attributes: ['size'] });
  const crashlogFiles = (directoryTree ? directoryTree.children : []).map((file) => {
    const timeSplit = file.name.replace('boot-', '').replace('crash-', '').replace('.bz2', '').split('--');
    let timeString = `${timeSplit[0]} ${timeSplit[1].replace(/-/g, ':')}`;
    if (timeString.indexOf('_') > 0) {
      // eslint-disable-next-line prefer-destructuring
      timeString = timeString.split('_')[0];
    }

    let dateObj = null;
    try {
      dateObj = Date.parse(timeString);
    } catch (exception) {
      // do nothing
    }
    if (!dateObj) {
      dateObj = new Date(0);
    }

    return {
      name: file.name,
      size: file.size,
      date: dateObj,
      permalink: `${config.baseDriveDownloadUrl}${dongleId}/${dongleIdHash}/crash/${file.name}`,
    };
  });
  crashlogFiles.sort((a, b) => ((a.date < b.date) ? 1 : -1));
  return crashlogFiles;
}

async function getBootlogs(dongleId) {
  const dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(dongleId).digest('hex');

  const directoryTree = dirTree(`${config.storagePath}${dongleId}/${dongleIdHash}/boot/`, { attributes: ['size'] });
  const bootlogFiles = (directoryTree ? directoryTree.children : []).map((file) => {
    const timeSplit = file.name.replace('boot-', '').replace('crash-', '').replace('.bz2', '').split('--');
    const timeString = `${timeSplit[0]} ${timeSplit[1].replace(/-/g, ':')}`;

    let dateObj = null;
    try {
      dateObj = Date.parse(timeString);
    } catch (exception) {
      // do nothing
    }
    if (!dateObj) dateObj = new Date(0);

    return {
      name: file.name,
      size: file.size,
      date: dateObj,
      permalink: `${config.baseDriveDownloadUrl}${dongleId}/${dongleIdHash}/boot/${file.name}`,
    };
  });
  bootlogFiles.sort((a, b) => ((a.date < b.date) ? 1 : -1));
  return bootlogFiles;
}

module.exports = {
  pairDevice,
  unpairDevice,
  setDeviceNickname,
  getDevices,
  getDeviceFromDongle,
  setIgnoredUploads,
  getAllDevicesFiltered,
  pairDeviceToAccountId,
  updateLastPing,
  isUserAuthorised,
  getOwnersFromDongle,

  // drive stuff, move maybe?
  getDrives,
  getBootlogs,
  getCrashlogs,
};
