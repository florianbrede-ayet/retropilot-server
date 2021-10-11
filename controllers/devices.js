const config = require('./../config');

const authenticationController = require('./authentication');
const models_orm = require('./../models/index.model')
const sanitize = require('sanitize')();


async function pairDevice(account, qr_string) {
     if (qr_string === undefined || qr_string === null) { return {success: false, badQr: true} }
    // Legacy registrations encode QR data as imei - serial - pairtoken, => 0.8.3 uses only a pairtoken

     var qrCodeParts = qr_string.split("--");
     let deviceQuery;
     let pairJWT;
     if (qrCodeParts.length > 0) {
        deviceQuery = await models_orm.models.device.findOne({ where: { imei: qrCodeParts[0], serial: qrCodeParts[1] }});
        pairJWT = qrCodeParts[2];
     } else {
         pairJWT = qr_string;
         const data = authenticationController.readJWT(qr_string);
         deviceQuery = await models_orm.models.device.findOne({ where: { dongle_id: data.identiy }});
     }

     if (deviceQuery.dataValues == null) {
         return {success: false, registered: false}
    }

     const device = deviceQuery.dataValues;
     var decoded = controllers.authentication.validateJWT(pairJWT, device.public_key);
     if (decoded == null || decoded.pair == undefined) {
        return {success: false, badToken: true}
    }
     if (device.account_id != 0) {
         return {success: false, alreadyPaired: true, dongle_id: device.dongle_id}
    }

    const update = models_orm.models.accounts.update(
        { account_id: account.id },
        { where: { dongle_id: device.dongle_id } }
    )

    return {success: true, paired: true, dongle_id: device.dongle_id, account_id: account.id}
}

async function unpairDevice(account, dongleId) {

    const device = await models_orm.models.device.getOne({where: {account_id: account.id, dongle_id: dongleId}});

    if (device && device.dataValues) {
        await models_orm.models.device.update({account_id: 0}, {where: {dongle_id: dongleId}});
        return {success: true}
    } else {
        return {success: false, msg: 'BAD DONGLE', invalidDongle: true};
    }
}

async function setDeviceNickname(account, dongleId, nickname) {
    const device = await models_orm.models.device.getOne({where: {account_id: account.id, dongle_id: dongleId}});

    const cleanNickname = sanitize.value(nickname, 'string')

    if (device && device.dataValues) {
        await models_orm.models.device.update({nickname: cleanNickname}, {where: {dongle_id: dongleId}});
        return {success: true, data: {nickname: cleanNickname}}
    } else {
        return {success: false, msg: 'BAD DONGLE', invalidDongle: true};
    }
}

async function getDevices(accountId) {
    const devices = await models_orm.models.device.getOne({where: {account_id: accountId}});

    return devices.dataValues || null
}

async function getDeviceFromDongle(dongleId) {
    const devices = await models_orm.models.device.getOne({where: {dongle_id: dongleId}});

    return devices.dataValues || null
}

async function setIgnoredUploads(dongleId, isIgnored) {
    const update = models_orm.models.accounts.update(
        { dongle_id: dongleId },
        { where: { uploads_ignored: isIgnored } }
    )

    // TODO check this change was processed..
    return true;
    
}

async function getAllDevicesFiltered() {
    console.log(models_orm.models.device)
    const devices = await models_orm.models.device.findAll();

    return devices.dataValues || null
}


module.exports = {
        pairDevice: pairDevice,
        unpairDevice: unpairDevice,
        setDeviceNickname: setDeviceNickname,
        getDevices: getDevices,
        getDeviceFromDongle,
        setIgnoredUploads,
        getAllDevicesFiltered,
    }
