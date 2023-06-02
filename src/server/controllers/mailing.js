import nodemailer from 'nodemailer';
import log4js from 'log4js';

const logger = log4js.getLogger('default');
const transporter = nodemailer.createTransport(
  {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: false,
  },
  { from: process.env.SMTP_FROM },
);

async function sendEmailVerification(token, email) {
  if (!process.env.CAN_SEND_MAIL) {
    return logger.warn(`Mailing disabled. ${email} - ${token}`);
  }

  let message,
    error,
    info;

  try {
    message = {
      from: process.env.SMTP_FROM,
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
