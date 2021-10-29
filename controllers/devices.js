const config = require('./../config');

const authenticationController = require('./authentication');
const models_orm = require('./../models/index.model')
const sanitize = require('sanitize')();
const { Op } = require('sequelize')


async function pairDevice(account, qr_string) {
     if (qr_string === undefined || qr_string === null) { return {success: false, badQr: true} }
    // Legacy registrations encode QR data as imei - serial - pairtoken, => 0.8.3 uses only a pairtoken

     var qrCodeParts = qr_string.split("--");
     let deviceQuery;
     let pairJWT;
     if (qrCodeParts.length > 0) {
        deviceQuery = await models_orm.models.device.findOne({ where: { serial: qrCodeParts[1] }});
        pairJWT = qrCodeParts[2];
     } else {
         pairJWT = qr_string;
         const data = authenticationController.readJWT(qr_string);
         deviceQuery = await models_orm.models.device.findOne({ where: { dongle_id: data.identiy }});
     }


     if (deviceQuery == null) {
         return {success: false, registered: false}
    }

     const device = deviceQuery.dataValues;
     var decoded = await authenticationController.validateJWT(pairJWT, device.public_key);
     if (decoded == null || decoded.pair == undefined) {
        return {success: false, badToken: true}
    }


     if (device.account_id != 0) {
         return {success: false, alreadyPaired: true, dongle_id: device.dongle_id}
    }
    return await pairDeviceToAccountId(device.dongle_id, account.id )
    
}

async function pairDeviceToAccountId(dongle_id, account_id) {
    console.log("input", account_id, dongle_id)
    const update = await  models_orm.models.device.update(
        { account_id: account_id },
        { where: {  dongle_id: dongle_id } }
    )

    console.log("update:" , update)

    const check = await models_orm.models.device.findOne({where: {dongle_id: dongle_id, account_id: account_id}})
    console.log(check);
    if (check.dataValues) {
        return {success: true, paired: true, dongle_id: dongle_id, account_id: account_id}
    } else {
        return {success: false, paired: false}
    }
    
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
    const devices = await models_orm.models.device.findAll();

    console.log("kkk", devices);

    return devices.dataValues
}

async function getDeviceFromDongle(dongleId) {
    const devices = await models_orm.models.device.findOne({where: {dongle_id: dongleId}});

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
    const devices = await models_orm.models.device.findAll();

    return devices
}


async function updateLastPing(device_id, dongle_id) {
    models_orm.models.device.update({ last_ping: Date.now() }, {where: {[Op.or] : [{id: device_id}, {dongle_id: dongle_id}]}})
}


module.exports = {
        pairDevice: pairDevice,
        unpairDevice: unpairDevice,
        setDeviceNickname: setDeviceNickname,
        getDevices: getDevices,
        getDeviceFromDongle,
        setIgnoredUploads,
        getAllDevicesFiltered,
        pairDeviceToAccountId,
        updateLastPing
    }
