const router = require('express').Router();
const config = require('./../../config');

const userController = require('./../../controllers/users')
const deviceController = require('./../../controllers/devices')
const authenticationController = require('./../../controllers/authentication')





// probs should put middleware somewhere else
router.use(async function (req, res, next) {
    const account = await authenticationController.getAuthenticatedAccount(req, res);

    if (account === null) {
        res.json({success: false, msg: 'NOT_AUTHENTICATED'})
    } else {
        req.account = account;
        next();
    }

    
});

router.get('/retropilot/0/devices',  async (req, res) => {
    if (!req.account) {return res.json({success: false, msg: 'NOT_AUTHENTICATED'})};

    const dongles = await deviceController.getDevices(req.account.id)

    res.json({success: true, data: dongles})
})

router.get('/retropilot/0/device/:dongle_id/drives/:deleted',  async (req, res) => {
    if (!req.account) {return res.json({success: false, msg: 'NOT_AUTHENTICATED'})};
    const isUserAuthorised = await deviceController.isUserAuthorised(req.account.id, req.params.dongle_id);

    // TODO reduce data returned`
    if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {return res.json({success: false, msg: isUserAuthorised.msg})}
   
    const dongles = await deviceController.getDrives(req.params.dongle_id, req.params.deleted === "true" ? true:false, true)

    res.json({success: true, data: dongles})
})

router.get('/retropilot/0/device/:dongle_id/bootlogs',  async (req, res) => {
    if (!req.account) {return res.json({success: false, msg: 'NOT_AUTHENTICATED'})};
    const isUserAuthorised = await deviceController.isUserAuthorised(req.account.id, req.params.dongle_id);
    // TODO reduce data returned`
    if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {return res.json({success: false, msg: isUserAuthorised.msg})}
   
    const bootlogs = await deviceController.getBootlogs(req.params.dongle_id)

    res.json({success: true, data: bootlogs})
})


router.get('/retropilot/0/device/:dongle_id/crashlogs',  async (req, res) => {
    if (!req.account) {return res.json({success: false, msg: 'NOT_AUTHENTICATED'})};
    const isUserAuthorised = await deviceController.isUserAuthorised(req.account.id, req.params.dongle_id);
    // TODO reduce data returned`
    if (isUserAuthorised.success === false || isUserAuthorised.data.authorised === false) {return res.json({success: false, msg: isUserAuthorised.msg})}
   
    const bootlogs = await deviceController.getCrashlogs(req.params.dongle_id)

    res.json({success: true, data: bootlogs})
})



module.exports = router;