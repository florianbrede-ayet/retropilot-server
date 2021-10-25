const router = require('express').Router();
const config = require('./../../config');

const userController = require('./../../controllers/users')

router.post('/retropilot/0/register/email', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
    if (!req.body.hasOwnProperty('email') || req.body.email === "" || !req.body.hasOwnProperty('password') || req.body.password === "") {
        res.json({success: false, msg: 'malformed request'}).status(400);
        logger.warn("/useradmin/register/token - Malformed Request!")
        return;
    }

    const accountStatus = await controllers.users.createAccount(req.body.email, req.body.password);

    if (accountStatus && accountStatus.status) {
        return res.json(accountStatus).status(accountStatus.status)
    } else {
        return res.json({success: false, msg: 'contact server admin'}).status(500);
    }
}));


router.get('/retropilot/0/register/verify/:token', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
    if (!req.params.token) {
        res.json({success: false, status: 400, data: {missingToken: true}}).status(400);
    }

    const verified = await userController.verifyEmailToken(req.params.token)

    if (verified && verified.status) {
        return res.json(verified).status(verified.status)
    } else {
        return res.json({success: false, msg: 'contact server admin'}).status(500);
    }
}));


module.exports = router;