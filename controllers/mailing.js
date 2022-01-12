import nodemailer from 'nodemailer';
import log4js from 'log4js';
import config from '../config';

const logger = log4js.getLogger('default');
const transporter = nodemailer.createTransport(
  {
    host: config.smtpHost,
    port: config.smtpPort,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
    logger: true,
    debug: false,
  },
  { from: config.smtpFrom },
);

async function sendEmailVerification(token, email) {
  if (!config.canSendMail) {
    return logger.warn(`Mailing disabled. ${email} - ${token}`);
  }

  let message,
    error,
    info;

  try {
    message = {
      from: config.smtpFrom,
      to: email.trim(),
      subject: 'RetroPilot Registration Token',
      text: `Your Email Registration Token Is: "${token}"`,
    };

    info = await transporter.sendMail(message);
  } catch (exception) {
    error = exception;
  }

  if (error) {
    logger.warn(`Email to ${email} FAILED ${error} - ${token}`);
    return false;
  }

  return info;
}

export default {
  sendEmailVerification,
};
