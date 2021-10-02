const config = require('./../config');
let models;
let logger;
const authenticationController = require('./authentication')(models, logger);

function pairDevice(account, qr_string) {

     // Legacy registrations encode QR data as imei - serial - pairtoken, => 0.8.3 uses only a pairtoken
     const qrCode = req.body.qr_string;
     var qrCodeParts = qrCode.split("--");
     let device;
     let pairJWT;
     if (qrCodeParts.length > 0) {
          device = await models.__db.get('SELECT * FROM devices WHERE imei = ? AND serial = ?', qrCodeParts[0], qrCodeParts[1]);
          pairJWT = qrCodeParts[2];
     } else {
         pairJWT = qrCode;
         const data = controllers.authentication.readJWT(qrCode);
         device = await models.__db.get('SELECT * FROM devices WHERE dongleId = ?', data.identiy);
     }

     if (device == null) {
         res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device not registered on Server'));
     }
     var decoded = controllers.authentication.validateJWT(pairJWT, device.public_key);
     if (decoded == null || decoded.pair == undefined) {
         res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device QR Token is invalid or has expired'));
     }
     if (device.account_id != 0) {
         res.redirect('/useradmin/overview?linkstatus=' + encodeURIComponent('Device is already paired, unpair in that account first'));
     }

     const result = await models.__db.run(
         'UPDATE devices SET account_id = ? WHERE dongle_id = ?',
         account.id,
         device.dongle_id
     );
}



module.exports = (_models, _logger, _controllers) => {
    models = _models;
    logger = _logger;
    controllers = _controllers

    return {
        
    }
}
