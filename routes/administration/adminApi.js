const router = require('express').Router();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { route } = require('../../server');
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



// probs should put middleware somewhere else
router.use(async function (req, res, next) {
    const currentAdmin = await controllers.admin.isCurrentUserAdmin(true, req);
    if (currentAdmin.isAdmin === false) {
        return res.status(402).json({error:true, msg: 'NOT AUTHORISED', status: 403}).end();
    } else {
        next();
    }
});


// TODO 


router.get('/admin/user/:userId/ban/:ban', runAsyncWrapper(async (req, res) => {
        const banResult  = await controllers.admin.banAccount(req.params.ban, req.params.userId)
        if (banResult.hasOwnProperty('success') && banResult.success === true) {
            res.status(200).json(banResult);
        } else {
            res.status(500).json(banResult)
        }
    
}));

router.get('/admin/user/:userId/get/devices', runAsyncWrapper(async (req, res) => {
    if (!req.params.userId) { return req.status(400).json({error: true, msg: 'MISSING DATA', status: 400})}

    return res.status(200).json({success: true, data: controllers.devices.getDevices(req.params.userId)})
}));



router.get('/admin/user/', runAsyncWrapper(async (req, res) => {
    console.warn("PROCESSED")
    

    return res.status(200).json({success: true, data: await controllers.users.getAllUsers()})

}));

router.get('/admin/device/:dongle_id', runAsyncWrapper(async (req, res) => {
    if (!req.params.dongle_id) { return req.status(400).json({error: true, msg: 'MISSING DATA', status: 400})}


    return res.status(200).json({success: true, data: await controllers.devices.getDeviceFromDongle(getDeviceFromDongle)})

}));

router.get('/admin/device', runAsyncWrapper(async (req, res) => {

    return res.status(200).json({success: true, data: await controllers.devices.getAllDevicesFiltered()})

}));

router.get('/admin/device/:dongle_id/ignore/:ignore_uploads', runAsyncWrapper(async (req, res) => {
    if (!req.params.dongle_id || !req.params.ignore_uploads) { return req.status(400).json({error: true, msg: 'MISSING DATA', status: 400})}


    



}));

router.get('/admin/device/:dongle_id/ignore/:ignore_uploads', runAsyncWrapper(async (req, res) => {
    if (!req.params.dongle_id || !req.params.ignore_uploads) { return req.status(400).json({error: true, msg: 'MISSING DATA', status: 400})}

    let ignore = null;

    switch (req.params.ignore_uploads) {
        case "true":
            ignore = true
            break;
        case "false":
            ignore = false
            break;
        default: 
            return res.json({error: true, msg: 'MISSING DATA'})
            break
    }

    if (ignore === null) {return}

    await controllers.devices.setIgnoredUploads(req.params.dongle_id);
    return res.status(200).json({success: true});

}));




module.exports = (_models, _controllers, _logger) => {
    models = _models;
    controllers = _controllers;
    logger = _logger;

    return router;
}