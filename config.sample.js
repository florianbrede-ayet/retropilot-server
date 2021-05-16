var config = {
    applicationSalt: 'RANDOM_SEED',
    
    databaseFile: 'database.json',
    
    allowAccountRegistration: true,
    
    httpInterface: '0.0.0.0',
    httpPort:  3000,
    
    httpsInterface: '0.0.0.0',
    httpsPort:  4430,
    sslKey: 'certs/retropilot.key',
    sslCrt: 'certs/retropilot.crt',

    baseUploadUrl: 'http://192.168.1.165:3000/backend/post_upload',
    
    baseDriveDownloadUrl: 'http://192.168.1.165:3000/realdata/',
    baseDriveDownloadPathMapping: '/realdata', // path mapping of above download url for expressjs, prefix with "/"

    storagePath: 'realdata/', // relative or absolute ( "/..." for absolute path )
    deviceStorageQuotaMb: 200000,
    deviceDriveQuota: 1000,
    deviceDriveExpirationDays: 30,
    
    cabanaUrl: 'http://192.168.1.165:3001/'    
};

module.exports = config;
