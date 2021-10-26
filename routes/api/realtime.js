const router = require('express').Router();

const authenticationController = require('./../../controllers/authentication');
const userController = require('./../../controllers/users');
const deviceController = require('./../../controllers/devices')

const whitelistParams = {
    getMessage: false,
    getVersion: true,
    setNavDestination: true,
    listDataDirectory: false,
    reboot: true,
    uploadFileToUrl: false,
    listUploadQueue: true,
    cancelUpload: true,
    primeActivated: false,
    getPublicKey: true,
    getSshAuthorizedKeys: true,
    getSimInfo: true,
    getNetworkType: true,
    getNetworks: true,
    takeSnapshot: true
}


router.get('/dongle/:dongle_id/connected', async (req, res) => {
    const account = await authenticationController.getAuthenticatedAccount(req, res);
    if (account == null) { return res.status(403).json({error: true, errorMsg: 'Unauthenticated', errorObject: {authenticated: false}})}
    const device = await deviceController.getDeviceFromDongle(req.params.dongle_id);
    if (!device) {return res.status(400).json({error: true, errorMsg: 'no_dongle', errorObject: {authenticated: true, dongle_exists: false}})}

    // TODO support delgation of access
    // TODO remove indication of dongle existing 
    if (device.account_id !== account.id) {return res.status(403).json({error: true, errorMsg: 'unauthorised', errorObject: {authenticated: true, dongle_exists: true, authorised_user: false}})}

    const deviceConnected = await req.athenaWebsocketTemp.isDeviceConnected(device.dongle_id);

    return res.status(200).json({success: true, dongle_id: device.dongle_id, data: deviceConnected});
})

router.get('/dongle/:dongle_id/getDetails', async (req, res) => {
    const account = await authenticationController.getAuthenticatedAccount(req, res);
    if (account == null) { return res.status(403).json({error: true, errorMsg: 'Unauthenticated', errorObject: {authenticated: false}})}
    const device = await deviceController.getDeviceFromDongle(req.params.dongle_id);
    if (!device) {return res.status(400).json({error: true, errorMsg: 'no_dongle', errorObject: {authenticated: true, dongle_exists: false}})}

    // TODO support delgation of access
    // TODO remove indication of dongle existing 
    if (device.account_id !== account.id) {return res.status(403).json({error: true, errorMsg: 'unauthorised', errorObject: {authenticated: true, dongle_exists: true, authorised_user: false}})}

    const deviceConnected = await req.athenaWebsocketTemp.getDetails(device.dongle_id);

   // return res.status(200).json({success: true, dongle_id: device.dongle_id, data: deviceConnected});
})


/*router.post('/dongle/:dongle_id/raw', bodyParser.urlencoded({extended: true}), async (req, res) => {
    if (!req.body.hasOwnProperty('method') { return res.status(403).json({error: true, errorMsg: 'missing_data', errorObject: {missing: [method]}})}
    const account = await authenticationController.getAuthenticatedAccount(req, res);
    if (account == null) { return res.status(403).json({error: true, errorMsg: 'Unauthenticated', errorObject: {authenticated: false}})}
    const device = await deviceController.getDeviceFromDongle(req.params.dongle_id);
    if (!device) {return res.status(400).json({error: true, errorMsg: 'no_dongle', errorObject: {authenticated: true, dongle_exists: false}})}

    // TODO support delgation of access
    // TODO remove indication of dongle existing 
    if (device.account_id !== account.id) {return res.status(403).json({error: true, errorMsg: 'unauthorised', errorObject: {authenticated: true, dongle_exists: true, authorised_user: false}})}

    const deviceConnected = await req.athenaWebsocketTemp.raw(req.body.method, req.body.params);

    return res.status(200).json({success: true, dongle_id: device.dongle_id, data: deviceConnected});
})*/



module.exports = router