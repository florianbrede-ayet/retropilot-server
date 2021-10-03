const config = require('./../config');
let models;
let logger;
const authenticationController = require('./authentication')(models, logger);
const models_orm = require('./../models/index.model')


async function pairDevice(account, qr_string) {
     if (qr_string === undefined || qr_string === null) { return {success: false, badQr: true} }
    // Legacy registrations encode QR data as imei - serial - pairtoken, => 0.8.3 uses only a pairtoken

     var qrCodeParts = qr_string.split("--");
     let deviceQuery;
     let pairJWT;
     if (qrCodeParts.length > 0) {
        deviceQuery = await models_orm.models.devices.findOne({ where: { imei: qrCodeParts[0], serial: qrCodeParts[1] }});
        pairJWT = qrCodeParts[2];
     } else {
         pairJWT = qr_string;
         const data = authenticationController.readJWT(qr_string);
         deviceQuery = await models_orm.models.devices.findOne({ where: { dongle_id: data.identiy }});
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



module.exports = (_models, _logger, _controllers) => {
    models = _models;
    logger = _logger;
    controllers = _controllers

    return {
        pairDevice: pairDevice
    }
}
