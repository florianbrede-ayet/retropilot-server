const config = require('./../config');
const nodemailer = require('nodemailer');

let models;
let logger;

let transporter = nodemailer.createTransport(
    {
        host: config.smtpHost,
        port: config.smtpPort,
        auth: {
            user: config.smtpUser,
            pass: config.smtpPassword
        },
        logger: true,
        debug: false
    },
    {from: config.smtpFrom}
);

async function sendEmailVerification(token, email) {
    if (!config.canSendMail) return logger.warn(`Mailing disabled. ${email} - ${token}`);

    let message, error, info;

    try {

        message = {
            from: config.smtpFrom,
            to: email.trim(),
            subject: 'RetroPilot Registration Token',
            text: 'Your Email Registration Token Is: "' + token + '"'
        };

        error, info = await transporter.sendMail(message);
    } catch (exception) {
        logger.warn(`Email to ${email} FAILED ${exception} - ${token}`)
    }
    

    if (error) {
        logger.warn(`Email to ${email} FAILED ${error} - ${token}`);
        return false;
    }

    return info;
}


module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        sendEmailVerification
    }
}
