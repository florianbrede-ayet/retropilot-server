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


module.exports = router;