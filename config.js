const config = {
    applicationSalt: process.env.RETRO_APPLICATION_SALT,

    databaseFile: process.env.RETRO_DATABASE_FILE,

    allowAccountRegistration: process.env.RETRO_ALLOW_ACCOUNT_REGISTRATION,

    httpInterface: process.env.RETRO_HTTP_INTERFACE,
    httpPort: process.env.RETRO_HTTP_PORT,

    httpsInterface: process.env.RETRO_HTTPS_INTERFACE,
    httpsPort: process.env.RETRO_HTTPS_PORT,
    sslKey: process.env.RETRO_SSL_KEY,
    sslCrt: process.env.RETRO_SSL_CRT,

    smtpHost: process.env.RETRO_SMTP_HOST,
    smtpPort: process.env.RETRO_SMTP_PORT,
    smtpUser: process.env.RETRO_SMTP_USER,
    smtpPassword: process.env.RETRO_SMTP_PASSWORD,
    smtpFrom: process.env.RETRO_SMTP_FROM,

    baseUrl: process.env.RETRO_BASE_URL,
    baseUploadUrl: process.env.RETRO_BASE_UPLOAD_URL,

    baseDriveDownloadUrl: process.env.RETRO_BASE_DRIVE_DOWNLOAD_URL,
    baseDriveDownloadPathMapping: process.env.RETRO_BASE_DOWNLOAD_PATH_MAPPING,
    storagePath: process.env.RETRO_STORAGE_PATH,

    cabanaUrl: process.env.RETRO_CABANA_URL,

    deviceStorageQuotaMb: process.env.RETRO_DEVICE_STORAGE_QUOTA_MB,
    deviceDriveExpirationDays: process.env.RETRO_DEVICE_DRIVE_EXPIRATION_DAYS,

    welcomeMessage: process.env.RETRO_WELCOME_MESSAGE,
};

module.exports = config;
