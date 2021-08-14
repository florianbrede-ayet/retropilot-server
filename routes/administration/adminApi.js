const router = require('express').Router();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('./../../config');


function runAsyncWrapper(callback) {
    return function (req, res, next) {
        callback(req, res, next)
            .catch(next)
    }
}

let models;
let controllers;
let logger;





// DRIVE & BOOT/CRASH LOG FILE UPLOAD HANDLING
router.get('/admin/user/:userId/ban/:ban', runAsyncWrapper(async (req, res) => {
    const account = await controllers.authentication.getAuthenticatedAccount(req, res);
    if (!account) return res.status(403).json({error: true, msg: 'BAD ACCOUNT', status: 403});
    if (account.admin !== 1) { return res.status(402).json({error:true, msg: 'NOT AUTHORISED', status: 403})}

    const banUser = await controllers.users.getAccountFromId(req.params.userId);
    if (banUser) {
        const banResult  = await controllers.admin.banAccount(req.params.ban, banUser)
        if (banResult.hasOwnProperty('success') && banResult.success === true) {
            res.status(200).json(banResult);
        } else {
            res.status(500).json(banResult)
        }
    } else {
        res.status(400).json({success: false, error: true, msg: 'NO ACCOUNT FOR ID'})
    }



}));


module.exports = (_models, _controllers, _logger) => {
    models = _models;
    controllers = _controllers;
    logger = _logger;

    return router;
}