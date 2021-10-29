var config = {
    applicationSalt: 'RANDOM_SEED',
    
    databaseFile: 'database.sqlite',
    
    allowAccountRegistration: true,
    
    httpInterface: '0.0.0.0',
    httpPort:  3000,
    
    httpsInterface: '0.0.0.0',
    httpsPort:  4430,
    sslKey: 'certs/retropilot.key',
    sslCrt: 'certs/retropilot.crt',

    canSendMail: true, // Skips sending mail, all attempted mail is logged under DEBUG
    smtpHost: "localhost", // credentials for smtp server to send account registration mails. if not filled in, get the generated tokens from the server.log manually
    smtpPort: 25,
    smtpUser: "root",
    smtpPassword: "",
    smtpFrom: "no-reply@retropilot.org",

    baseUrl: 'http://192.168.1.165:3000/',  // base url of the retropilot server
    baseUploadUrl: 'http://192.168.1.165:3000/backend/post_upload', // base url sent to devices for POSTing drives & logs
    
    baseDriveDownloadUrl: 'http://192.168.1.165:3000/realdata/', // base download url for drive & log data
    baseDriveDownloadPathMapping: '/realdata', // path mapping of above download url for expressjs, prefix with "/"
    storagePath: 'realdata/', // relative or absolute ( "/..." for absolute path )

    cabanaUrl: 'http://192.168.1.165:3000/cabana/index.html',

    deviceStorageQuotaMb: 200000,
    deviceDriveExpirationDays: 30,
    

    welcomeMessage: `<><><><><><><><><><><><><><><><><><><><><><><br>2021 RetroPilot`,

    flags: {
        useUserAdminApi: false,
    },
    
    athena: {
        enabled: true, // Enables Athena service
        api: {
            ratelimit: 100 // Maxmium hits to /realtime/* per 30s 
        },
        socket: {
            heartbeatFrequency: 5000 // Higher the number = lower traffic, varies on how many devices are connected
        }
    }
};

module.exports = config;
