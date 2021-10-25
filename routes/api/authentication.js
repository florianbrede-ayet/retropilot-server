const router = require('express').Router();
const config = require('./../config');

const authenticationController = require('./../../controllers/authentication');
const userController = require('./../../controllers/users');




function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}


router.post('/retropilot/0/useradmin/auth', bodyParser.urlencoded({extended: true}), runAsyncWrapper(async (req, res) => {
    const signIn = await authentication.signIn(req.body.email, req.body.password)

    if (signIn.success) {
        res.cookie('jwt', signIn.jwt, {signed: true});
        res.redirect('/useradmin/overview');
    } else {
        res.redirect('/useradmin?status=' + encodeURIComponent('Invalid credentials or banned account'));
    }
}))


router.get('/retropilot/0/useradmin/signout', runAsyncWrapper(async (req, res) => {
    res.clearCookie('session');
    return res.json({success: true});
}))

router.get('/session/get', runAsyncWrapper(async (req, res) => {
    const account = await controllers.authentication.getAuthenticatedAccount(req, res);

    if (!account) {
        res.json({success: true, hasSession: false, session: {}})
    } else {
        res.json({success: true, hasSession: false, session: account})

    }

}))

module.exports = router