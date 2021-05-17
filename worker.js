const config = require('./config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const  log4js = require('log4js');

const lockfile = require('proper-lockfile');

var http = require('http');
var https = require('https');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser=require('cookie-parser');
const jwt = require('jsonwebtoken');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const sendmail = require('sendmail')();

const htmlspecialchars = require('htmlspecialchars');

const dirTree = require("directory-tree");
const { resolve } = require('path');
const execSync = require('child_process').execSync;


const Reader = require('@commaai/log_reader');
var ffprobe = require('ffprobe'),
    ffprobeStatic = require('ffprobe-static');
const { exception } = require('console');
 
const adapter = new FileSync(config.databaseFile);
const db = low(adapter);

const ALL = 1E8;
var lastCleaningTime=0;
var startTime=Date.now();


log4js.configure({
    appenders: { logfile: { type: "file", filename: "worker.log" }, out: { type: "console"} },
    categories: { default: { appenders: ['out', 'logfile'], level: 'info' } }    
});
  
var logger = log4js.getLogger('default'); 


function initializeDatabase() {
    db.read();
    if (!db.has('devices').value()) {
        logger.error("database not initialized, exit worker");
        process.exit();
    }
}

function initializeStorage() {
    var verifiedPath = mkDirByPathSync(config.storagePath, {isRelativeToScript: (config.storagePath.indexOf("/")===0 ? false : true)});
    if (verifiedPath!=null)
        logger.info("Verified storage path "+verifiedPath);
    else {
        logger.error("Unable to verify storage path '"+config.storagePath+"', check filesystem / permissions");
        process.exit();
    }    
}


function validateJWTToken(token, publicKey) {
    try {
        var decoded = jwt.verify(token.replace("JWT ", ""), publicKey, { algorithms: ['RS256'] });
        return decoded;
    } catch (exception) {
        console.log(exception);
    }
    return null;
}

function formatDate(timestampMs) {
    return new Date(timestampMs).toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

function formatDuration(durationSeconds) {
    var secs = durationSeconds % 60;
    var mins = Math.floor(durationSeconds / 60);
    var hours = Math.floor(mins / 60);
    mins = mins % 60;

    var response='';
    if (hours>0) response+=hours+'h ';
    if (hours>0 || mins>0) response+=mins+'m ';
    response+=secs+'s';
    return response;
}

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') { // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
        logger.error(`EACCES: permission denied, mkdir '${parentDir}'`);
        return null;
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
        logger.error("'EACCES', 'EPERM', 'EISDIR' during mkdir");
        return null;
      }
    }

    return curDir;
  }, initDir);
}

function simpleStringify (object){
    var simpleObject = {};
    for (var prop in object ){
        if (!object.hasOwnProperty(prop)){
            continue;
        }
        if (typeof(object[prop]) == 'object'){
            continue;
        }
        if (typeof(object[prop]) == 'function'){
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject); // returns cleaned up JSON
};

function writeFileSync(path, buffer, permission) {
    var fileDescriptor;
    try {
        fileDescriptor = fs.openSync(path, 'w', permission);
    } catch (e) {
        fs.chmodSync(path, permission);
        fileDescriptor = fs.openSync(path, 'w', permission);
    }

    if (fileDescriptor) {
        fs.writeSync(fileDescriptor, buffer, 0, buffer.length, 0);
        fs.closeSync(fileDescriptor);
        logger.info("writeFileSync wiriting to '"+path+"' successful");
        return true;
    }
    logger.error("writeFileSync writing to '"+path+"' failed");
    return false;
}

function moveUploadedFile(buffer, directory, filename) {
    logger.info("moveUploadedFile called with '"+filename+"' -> '"+directory+"'");

    if (directory.indexOf("..")>=0 || filename.indexOf("..")>=0) {
        logger.error("moveUploadedFile failed, .. in directory or filename");
        return false;
    }
    
    if (config.storagePath.lastIndexOf("/")!==config.storagePath.length-1)
        directory='/'+directory;
    if (directory.lastIndexOf("/")!==directory.length-1)
        directory=directory+'/';
        
    var finalPath = mkDirByPathSync(config.storagePath+directory, {isRelativeToScript: (config.storagePath.indexOf("/")===0 ? false : true)});
    if (finalPath && finalPath.length>0) {
        if (writeFileSync(finalPath+"/"+filename, buffer, 0o660)) {
            logger.info("moveUploadedFile successfully written '"+(finalPath+"/"+filename)+"'");            
            return finalPath+"/"+filename;
        }
        logger.error("moveUploadedFile failed to writeFileSync");            
        return false;
    }
    logger.error("moveUploadedFile invalid final path, check permissions to create / write '"+(config.storagePath+directory)+"'");
    return false;    
};


function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file, index) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
};

var segmentProcessQueue=[];
var segmentProcessPosition=0;

var affectedDrives={};
var affectedDevices={};

var rlog_lastTs=0;
var rlog_prevLat=-1000;
var rlog_prevLng=-1000;
var rlog_totalDist = 0;
var qcamera_duration = 0;

function processSegmentRLog(rLogPath) {

    rlog_lastTs=0;
    rlog_prevLat=-1000;
    rlog_prevLng=-1000;
    rlog_totalDist = 0;

    return new Promise(
      function(resolve, reject) {
        var readStream = fs.createReadStream(rLogPath);
        var reader = Reader(readStream);
        readStream.on('close', function () {
            resolve();
        });

        reader(function (obj) {
            try {
                if (obj['LogMonoTime']!==undefined && obj['LogMonoTime']-rlog_lastTs>=1000000*1000*1 && obj['GpsLocation']!==undefined) {
                    logger.info('processSegmentRLog GpsLocation @ '+obj['LogMonoTime']+': '+obj['GpsLocation']['Latitude']+' '+obj['GpsLocation']['Longitude']);
                
                    if (rlog_prevLat!=-1000) {
                        var lat1=rlog_prevLat;
                        var lat2=obj['GpsLocation']['Latitude'];
                        var lon1=rlog_prevLng;
                        var lon2=obj['GpsLocation']['Longitude'];
                        var p = 0.017453292519943295;    // Math.PI / 180
                        var c = Math.cos;
                        var a = 0.5 - c((lat2 - lat1) * p)/2 + 
                                c(lat1 * p) * c(lat2 * p) * 
                                (1 - c((lon2 - lon1) * p))/2;
                    
                        var dist_m = 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
                        rlog_totalDist+=dist_m;
                        //console.log('---> distance traveled is: '+dist_m);
                    }
                    rlog_prevLat=obj['GpsLocation']['Latitude'];
                    rlog_prevLng=obj['GpsLocation']['Longitude'];
                    rlog_lastTs = obj['LogMonoTime'];
                }    
            } catch(exception) {

            }
        });  
      }
  );
}

function processSegmentVideo(qcameraPath) {
    qcamera_duration=0;
    return new Promise(function(resolve, reject) {
        ffprobe(qcameraPath, { path: ffprobeStatic.path })
        .then(function (info) {
            if (info['streams']!==undefined && info['streams'][0]!==undefined && info['streams'][0]['duration']!==undefined)
                qcamera_duration = info['streams'][0]['duration'];
                logger.info('processSegmentVideo duration: '+qcamera_duration+'s');
                resolve();
        })
        .catch(function (err) {
            console.error(err);
            logger.error('processSegmentVideo error: '+err);
            resolve();
        });
    });
}

function processSegmentsRecursive() {
    if (segmentProcessQueue.length<=segmentProcessPosition) 
        return updateDrives();

    var segmentWrapper = segmentProcessQueue[segmentProcessPosition];
    var segment = db.get('drive_segments').find({dongle_id: segmentWrapper.segment.dongle_id, drive_identifier: segmentWrapper.segment.drive_identifier, segment_id: segmentWrapper.segment.segment_id});
    const uploadComplete = segmentWrapper.uploadComplete;
    const driveIdentifier = segmentWrapper.driveIdentifier;
    const fileStatus = segmentWrapper.fileStatus;

    logger.info('processSegmentsRecursive '+segment.value().dongle_id+' '+segment.value().drive_identifier+' '+segment.value().segment_id);

    var p1 = processSegmentRLog(fileStatus['rlog.bz2']);
    var p2 = processSegmentVideo(fileStatus['qcamera.ts']);
    Promise.all([p1, p2]).then((values) => {
        logger.info('processSegmentsRecursive '+segment.value().dongle_id+' '+segment.value().drive_identifier+' '+segment.value().segment_id+' '+(Math.round(rlog_totalDist*100)/100)+'m, duration: '+qcamera_duration+'s');
        
        var updates={duration: qcamera_duration, distance_meters: Math.round(rlog_totalDist*10)/10, is_processed: true, upload_complete: uploadComplete, is_stalled: false};
        segment.assign(updates).write();

        affectedDrives[driveIdentifier]=true;

        segmentProcessPosition++;
        setTimeout(function() {processSegmentsRecursive();}, 0);
    }).catch(function () {    });
}

function updateSegments() {
    segmentProcessQueue=[];
    segmentProcessPosition=0;
    affectedDrives={};

    drive_segments = db.get('drive_segments').filter({upload_complete: false, is_stalled: false}).sortBy('created').take(ALL).value();
    for (var t=0; t<drive_segments.length; t++) {
        var segment = drive_segments[t];
        
        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(segment.dongle_id).digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(segment.drive_identifier).digest('hex');

        const directoryTree = dirTree(config.storagePath+segment.dongle_id+"/"+dongleIdHash+"/"+driveIdentifierHash+"/"+segment.drive_identifier+"/"+segment.segment_id);
        var qcamera = false;
        var fcamera = false;
        var dcamera = false;
        var qlog = false;
        var rlog = false;
        var fileStatus = {'fcamera.hevc': false, 'dcamera.hevc' : false, 'qcamera.ts': false, 'qlog.bz2' : false, 'rlog.bz2' : false};

        for (var i in directoryTree.children) {
            fileStatus[directoryTree.children[i].name]=directoryTree.children[i].path;
        }
        

        var uploadComplete=false;
        if (fileStatus['qcamera.ts']!==false && fileStatus['fcamera.hevc']!==false && fileStatus['rlog.bz2']!==false && fileStatus['qlog.bz2']!==false) // upload complete
            uploadComplete=true;

        if (fileStatus['qcamera.ts']!==false && fileStatus['rlog.bz2']!==false && !segment.is_processed) { // can process
            segmentProcessQueue.push({segment: segment, fileStatus: fileStatus, uploadComplete: uploadComplete, driveIdentifier: segment.dongle_id+"|"+segment.drive_identifier});
        }
        else if (uploadComplete) {
            logger.info('updateSegments uploadComplete for '+segment.dongle_id+' '+segment.drive_identifier+' '+segment.segment_id);
            var updateSegment = db.get('drive_segments').find({dongle_id: segment.dongle_id, drive_identifier: segment.drive_identifier, segment_id: segment.segment_id});
            var updates={upload_complete: true, is_stalled: false};
            updateSegment.assign(updates).write();    
            affectedDrives[segment.dongle_id+"|"+segment.drive_identifier]=true;
        }
        else if (Date.now()-segment.created>10*24*3600*1000) { // ignore non-uploaded segments after 10 days until a new upload_url is requested (which resets is_stalled)
            logger.info('updateSegments isStalled for '+segment.dongle_id+' '+segment.drive_identifier+' '+segment.segment_id);
            var updateSegment = db.get('drive_segments').find({dongle_id: segment.dongle_id, drive_identifier: segment.drive_identifier, segment_id: segment.segment_id});
            var updates={is_stalled: true};
            updateSegment.assign(updates).write();    
        }

        if (segmentProcessQueue.length>50) // we process at most 50 segments per batch
            break;
    }

    if (segmentProcessQueue.length>0)
        processSegmentsRecursive();
    else // if no data is to be collected, call updateDrives to update those where eventually just the last segment completed the upload
        updateDrives();

}

function updateDevices() {
    // go through all affected devices (with deleted or updated drives) and update them (storage_used)
    logger.info("updateDevices - affected drives: "+JSON.stringify(affectedDevices));
    for (const [key, value] of Object.entries(affectedDevices)) {
        var dongleId = key;

        var device = db.get('devices').find({dongle_id: dongleId});
        if (!device.value()) continue;

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.value().dongle_id).digest('hex');
        var devicePath=config.storagePath+device.value().dongle_id+"/"+dongleIdHash;
        var deviceQuotaMb = Math.round(parseInt(execSync("du -s "+devicePath+" | awk -F'\t' '{print $1;}'").toString())/1024);
        logger.info("updateDevices device "+dongleId+" has an updated storage_used of: "+deviceQuotaMb+" MB");
        device.assign({storage_used: deviceQuotaMb}).write();
    }
    affectedDevices=[];
}

function updateDrives() {
    // go through all affected drives and update them / complete and/or build m3u8
    logger.info("updateDrives - affected drives: "+JSON.stringify(affectedDrives));
    for (const [key, value] of Object.entries(affectedDrives)) {
        [dongleId, driveIdentifier] = key.split('|');
        var drive = db.get('drives').find({ identifier: driveIdentifier, dongle_id: dongleId});
        if (!drive.value()) continue;

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.value().dongle_id).digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(drive.value().identifier).digest('hex');
        var driveUrl=config.baseDriveDownloadUrl+drive.value().dongle_id+"/"+dongleIdHash+"/"+driveIdentifierHash+"/"+drive.value().identifier;
        var drivePath=config.storagePath+drive.value().dongle_id+"/"+dongleIdHash+"/"+driveIdentifierHash+"/"+drive.value().identifier;

        var uploadComplete=true;
        var isProcessed=true;
        
        var totalDistanceMeters=0;
        var totalDurationSeconds=0;
        var playlistSegmentStrings='';

        drive_segments = db.get('drive_segments').filter({drive_identifier: driveIdentifier, dongle_id: dongleId}).sortBy('created').take(ALL).value();
        for (var t=0; t<drive_segments.length; t++) {
            if (!drive_segments[t].upload_complete) uploadComplete=false;
            if (!drive_segments[t].is_processed) isProcessed=false;
            else {
                totalDistanceMeters+=parseFloat(drive_segments[t].distance_meters);
                totalDurationSeconds+=parseFloat(drive_segments[t].duration);

                playlistSegmentStrings+=`#EXTINF:`+drive_segments[t].duration+`,`+drive_segments[t].segment_id+`\n`+
                    driveUrl+`/`+drive_segments[t].segment_id+`/qcamera.ts\n`;
            }            
        }

        var updates = {distance_meters: Math.round(totalDistanceMeters), duration: totalDurationSeconds, upload_complete : uploadComplete, is_processed : isProcessed};
        if (uploadComplete) {
            updates['filesize'] = 0;
            try {
                var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(dongleId).digest('hex');
                var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(driveIdentifier).digest('hex');
                updates['filesize'] = parseInt(execSync("du -s "+drivePath+" | awk -F'\t' '{print $1;}'").toString()); // in kilobytes
            }
            catch (exception) {}    
        } 
        logger.info("updateDrives drive "+dongleId+" "+driveIdentifier+" uploadComplete: "+JSON.stringify(updates));
        drive.assign(updates).write();

        affectedDevices[dongleId]=true;
        
        if (isProcessed) {
            // create the playlist file m3u8 for cabana
            var playlist = `#EXTM3U\n`+
            `#EXT-X-VERSION:3\n`+
            `#EXT-X-TARGETDURATION:61\n`+
            `#EXT-X-MEDIA-SEQUENCE:0\n`+
            `#EXT-X-PLAYLIST-TYPE:VOD\n`+
            playlistSegmentStrings+`\n`+
            `#EXT-X-ENDLIST`;

            fs.writeFileSync(drivePath+'/qcamera.m3u8', playlist);
        }

    }

    updateDevices();

    setTimeout(function() {mainWorkerLoop();}, 0);
}

function deleteExpiredDrives() {
    var expirationTs = Date.now()-config.deviceDriveExpirationDays*24*3600*1000;

    var expiredDrives = db.get('drives').filter({is_preserved: false, is_deleted: false}).orderBy('created', 'asc').take(ALL).value();
    for (var t=0; t<expiredDrives.length; t++) {
        if (expiredDrives[t].created>expirationTs) {
            break; // the drives are queried ordered by date, so break at the first newer one
        }
        
        var drive = db.get('drives').find({ identifier: expiredDrives[t].identifier, dongle_id: expiredDrives[t].dongle_id});
        if (!drive.value()) continue;
        logger.info("deleteExpiredDrives drive "+expiredDrives[t].dongle_id+" "+expiredDrives[t].identifier+" is older than "+config.deviceDriveExpirationDays+" days, set is_deleted=true");
        drive.assign({is_deleted: true}).write();
    }
}


function removeDeletedDrivesPhysically() {
    var expiredDrives = db.get('drives').filter({is_deleted: true}).orderBy('created', 'asc').take(ALL).value();
    for (var t=0; t<expiredDrives.length; t++) {
        logger.info("removeDeletedDrivesPhysically drive "+expiredDrives[t].dongle_id+" "+expiredDrives[t].identifier+" is deleted, remove physical files and clean database");
        var drive = db.get('drives').find({ identifier: expiredDrives[t].identifier, dongle_id: expiredDrives[t].dongle_id});
        if (!drive.value()) continue;

        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(expiredDrives[t].dongle_id).digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt).update(expiredDrives[t].identifier).digest('hex');

        const drivePath = config.storagePath+expiredDrives[t].dongle_id+"/"+dongleIdHash+"/"+driveIdentifierHash+"";
        logger.info("removeDeletedDrivesPhysically drive "+expiredDrives[t].dongle_id+" "+expiredDrives[t].identifier+" storage path is "+drivePath);
         try {
            deleteFolderRecursive(drivePath, { recursive: true });
            db.get('drives').remove({ identifier: expiredDrives[t].identifier, dongle_id: expiredDrives[t].dongle_id}).write();
            affectedDevices[expiredDrives[t].dongle_id]=true;
        } catch (exception) {
            logger.error(exception);
        }
    }
}

function deleteOverQuotaDrives() {
    var devices = db.get('devices').filter({}).orderBy('storage_used', 'desc').take(ALL).value();
    for (var t=0; t<devices.length; t++) {
        if (devices[t].storage_used>config.deviceStorageQuotaMb) {
            var foundDriveToDelete=false;

            var allDrives = db.get('drives').filter({dongle_id: devices[t].dongle_id, is_preserved: false, is_deleted: false}).orderBy('created', 'asc').take(1).value();
            for (var i=0; i<allDrives.length; i++) {
                logger.info("deleteExpiredDrives drive "+allDrives[i].dongle_id+" "+allDrives[i].identifier+" (normal) is deleted for over-quota");
                var drive = db.get('drives').find({ identifier: allDrives[i].identifier, dongle_id: allDrives[i].dongle_id});
                if (!drive.value()) continue;
                drive.assign({is_deleted: true}).write();
                foundDriveToDelete=true;
                break;
            }

            if (!foundDriveToDelete) {
                var allDrives = db.get('drives').filter({dongle_id: devices[t].dongle_id, is_preserved: true, is_deleted: false}).orderBy('created', 'asc').take(1).value();
                for (var i=0; i<allDrives.length; i++) {
                    logger.info("deleteOverQuotaDrives drive "+allDrives[i].dongle_id+" "+allDrives[i].identifier+" (preserved!) is deleted for over-quota");
                    var drive = db.get('drives').find({ identifier: allDrives[i].identifier, dongle_id: allDrives[i].dongle_id});
                    if (!drive.value()) continue;
                    drive.assign({is_deleted: true}).write();
                    foundDriveToDelete=true;
                    break;
                }
            }
        }
    }
}

function deleteBootAndCrashLogs() {
    var devices = db.get('devices').filter({}).take(ALL).value();
    for (var t=0; t<devices.length; t++) {   
        var device = devices[t];
        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt).update(device.dongle_id).digest('hex');
            
        const bootlogDirectoryTree = dirTree(config.storagePath+device.dongle_id+"/"+dongleIdHash+"/boot/", {attributes:['size']});
        var bootlogFiles = [];
        if (bootlogDirectoryTree!=undefined) {
            for (var i=0; i<bootlogDirectoryTree.children.length; i++) {
                
                var timeSplit = bootlogDirectoryTree.children[i].name.replace('boot-', '').replace('crash-', '').replace('\.bz2', '').split('--');
                var timeString = timeSplit[0]+' '+timeSplit[1].replace('-',':');
                bootlogFiles.push({'name': bootlogDirectoryTree.children[i].name, 'size': bootlogDirectoryTree.children[i].size, 'date': Date.parse(timeString), 'path' : bootlogDirectoryTree.children[i].path});
            }
            bootlogFiles.sort((a,b) => (a.date < b.date) ? 1 : -1);
            for (var c=5; c<bootlogFiles.length; c++) {
                logger.info("deleteBootAndCrashLogs deleting boot log "+bootlogFiles[c]['path']+"");
                try {
                    fs.unlinkSync(bootlogFiles[c]['path']);
                    affectedDevices[device.dongle_id]=true;
                } catch (exception) {
                    logger.error(exception);
                }
            }
        }

        const crashlogDirectoryTree = dirTree(config.storagePath+device.dongle_id+"/"+dongleIdHash+"/crash/", {attributes:['size']});
        var crashlogFiles = [];
        if (crashlogDirectoryTree!=undefined) {
            for (var i=0; i<crashlogDirectoryTree.children.length; i++) {
                
                var timeSplit = crashlogDirectoryTree.children[i].name.replace('boot-', '').replace('crash-', '').replace('\.bz2', '').split('--');
                var timeString = timeSplit[0]+' '+timeSplit[1].replace('-',':');
                crashlogFiles.push({'name': crashlogDirectoryTree.children[i].name, 'size': crashlogDirectoryTree.children[i].size, 'date': Date.parse(timeString)});
            }
            crashlogFiles.sort((a,b) => (a.date < b.date) ? 1 : -1);
            for (var c=5; c<crashlogFiles.length; c++) {
                logger.info("deleteBootAndCrashLogs deleting crash log "+crashlogFiles[c]['path']+"");
                try {
                    fs.unlinkSync(crashlogFiles[c]['path']);
                    affectedDevices[device.dongle_id]=true;
                } catch (exception) {
                    logger.error(exception);
                }
            }
        }
    }
}


function mainWorkerLoop() {
    if (Date.now()-startTime>60*3600*1000) {
        logger.info("EXIT WORKER AFTER 1 HOUR TO PREVENT MEMORY LEAKS...");
        process.exit();
    }


    if (Date.now()-lastCleaningTime>20*3600*1000) {
        deleteBootAndCrashLogs();
        deleteExpiredDrives();
        deleteOverQuotaDrives();
        removeDeletedDrivesPhysically();
        lastCleaningTime=Date.now();
    }
    
    setTimeout(function() {updateSegments();}, 5000);


}


lockfile.lock('retropilot_worker.lock', { realpath: false, stale: 30000, update: 2000 })
.then((release) => {
    logger.info("STARTING WORKER...");
    initializeDatabase();
    initializeStorage();
    setTimeout(function() {mainWorkerLoop();}, 0);
}).catch((e) => {
    console.error(e)
    process.exit();	  		  
});