/* eslint-disable */
import config from './config';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import log4js from 'log4js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import lockfile from 'proper-lockfile';
import jwt from 'jsonwebtoken';
import dirTree from 'directory-tree';
import { execSync } from 'child_process';
import Reader from '@commaai/log_reader';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import orm from './models/index.model'

var db = null;

var lastCleaningTime = 0;
var startTime = Date.now();

log4js.configure({
    appenders: { logfile: { type: 'file', filename: 'worker.log' }, out: { type: 'console' } },
    categories: { default: { appenders: ['out', 'logfile'], level: 'info' } }
});

var logger = log4js.getLogger('default');

function initializeStorage() {
  var verifiedPath = mkDirByPathSync(config.storagePath, { isRelativeToScript: (config.storagePath.indexOf('/') !== 0) });
  if (verifiedPath != null) {
    logger.info(`Verified storage path ${verifiedPath}`);
  }
  else {
    logger.error(`Unable to verify storage path '${config.storagePath}', check filesystem / permissions`);
    process.exit();
  }
}

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const { sep } = path;
  const initDir = path.isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep)
    .reduce((parentDir, childDir) => {
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
          logger.error('\'EACCES\', \'EPERM\', \'EISDIR\' during mkdir');
          return null;
        }
      }

      return curDir;
    }, initDir);
}

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
    logger.info(`writeFileSync wiriting to '${path}' successful`);
    return true;
  }
  logger.error(`writeFileSync writing to '${path}' failed`);
  return false;
}

// eslint-disable-next-line
function moveUploadedFile(buffer, directory, filename) {
  logger.info(`moveUploadedFile called with '${filename}' -> '${directory}'`);

  if (directory.indexOf('..') >= 0 || filename.indexOf('..') >= 0) {
    logger.error('moveUploadedFile failed, .. in directory or filename');
    return false;
  }

  if (config.storagePath.lastIndexOf('/') !== config.storagePath.length - 1) {
    directory = `/${directory}`;
  }
  if (directory.lastIndexOf('/') !== directory.length - 1) directory += '/';

  var finalPath = mkDirByPathSync(config.storagePath + directory, { isRelativeToScript: (config.storagePath.indexOf('/') !== 0) });
  if (finalPath && finalPath.length > 0) {
    if (writeFileSync(`${finalPath}/${filename}`, buffer, 0o660)) {
      logger.info(`moveUploadedFile successfully written '${finalPath}/${filename}'`);
      return `${finalPath}/${filename}`;
    }
    logger.error('moveUploadedFile failed to writeFileSync');
    return false;
  }
  logger.error(`moveUploadedFile invalid final path, check permissions to create / write '${config.storagePath + directory}'`);
  return false;
}

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath)
      .forEach((file, index) => {
        const curPath = path.join(directoryPath, file);
        if (fs.lstatSync(curPath)
          .isDirectory()) {
          deleteFolderRecursive(curPath);
        }
        else {
          fs.unlinkSync(curPath);
        }
      });
    fs.rmdirSync(directoryPath);
  }
}

async function dbProtectedRun() {
  let retries = 0;
  while (true) {
    try {
        return await db.run(...arguments);
    } catch (error) {
      logger.error(error);
      retries++;
      if (retries >= 10) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  logger.error(`unable to complete dbProtectedRun for ${arguments}`);
  return null;
}

async function dbProtectedGet() {
  let retries = 0;
  while (true) {
    try {
        return await db.get(...arguments);
    } catch (error) {
      logger.error(error);
      retries++;
      if (retries >= 10) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  logger.error(`unable to complete dbProtectedGet for ${arguments}`);
  return null;
}

async function dbProtectedAll() {
  let retries = 0;
  while (true) {
    try {
        return await db.all(...arguments);
    } catch (error) {
      logger.error(error);
      retries++;
      if (retries >= 10) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  logger.error(`unable to complete dbProtectedGet for ${arguments}`);
  return null;
}

var segmentProcessQueue = [];
var segmentProcessPosition = 0;

var affectedDrives = {};
var affectedDriveInitData = {};
var affectedDriveCarParams = {};

var affectedDevices = {};

var rlog_lastTsInternal = 0;
var rlog_prevLatInternal = -1000;
var rlog_prevLngInternal = -1000;
var rlog_totalDistInternal = 0;
var rlog_lastTsExternal = 0;
var rlog_prevLatExternal = -1000;
var rlog_prevLngExternal = -1000;
var rlog_totalDistExternal = 0;
var qcamera_duration = 0;

function processSegmentRLog(rLogPath) {
  rlog_lastTsInternal = 0;
  rlog_prevLatInternal = -1000;
  rlog_prevLngInternal = -1000;
  rlog_totalDistInternal = 0;
  rlog_lastTsExternal = 0;
  rlog_prevLatExternal = -1000;
  rlog_prevLngExternal = -1000;
  rlog_totalDistExternal = 0;
  rlog_CarParams = null;
  rlog_InitData = null;

  return new Promise(
    (resolve, reject) => {
      var temporaryFile = rLogPath.replace('.bz2', '');

      try {
        execSync(`bunzip2 -k -f "${rLogPath}"`);
      } catch (exception) { // if bunzip2 fails, something was wrong with the file (corrupt / missing)
        logger.error(exception);
        try {
          fs.unlinkSync(temporaryFile);
        } catch (exception) { }
        resolve();
        return;
      }

      let readStream;
      let reader;
      try {
        readStream = fs.createReadStream(temporaryFile);
        reader = Reader(readStream);
      } catch (err) {
        logger.error('314 - logger', err);
      }

      readStream.on('close', () => {
        logger.info('processSegmentRLog readStream close event triggered, resolving promise');
        try {
          fs.unlinkSync(temporaryFile);
        } catch (exception) { }
        resolve();
      });
      try {
        reader((obj) => {
          try {
            if (obj.LogMonoTime !== undefined && obj.LogMonoTime - rlog_lastTsInternal >= 1000000 * 1000 * 0.99 && obj.GpsLocation !== undefined) {
              logger.info(`processSegmentRLog GpsLocation @ ${obj.LogMonoTime}: ${obj.GpsLocation.Latitude} ${obj.GpsLocation.Longitude}`);

              if (rlog_prevLatInternal != -1000) {
                var lat1 = rlog_prevLatInternal;
                var lat2 = obj.GpsLocation.Latitude;
                var lon1 = rlog_prevLngInternal;
                var lon2 = obj.GpsLocation.Longitude;
                var p = 0.017453292519943295; // Math.PI / 180
                var c = Math.cos;
                var a = 0.5 - c((lat2 - lat1) * p) / 2
                  + c(lat1 * p) * c(lat2 * p)
                  * (1 - c((lon2 - lon1) * p)) / 2;

                var dist_m = 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
                if (dist_m > 70) dist_m = 0; // each segment is max. 60s. if the calculated speed would exceed ~250km/h for this segment, we assume the coordinates off / defective and skip it
                rlog_totalDistInternal += dist_m;
              }
              rlog_prevLatInternal = obj.GpsLocation.Latitude;
              rlog_prevLngInternal = obj.GpsLocation.Longitude;
              rlog_lastTsInternal = obj.LogMonoTime;
            }
            else if (obj.LogMonoTime !== undefined && obj.LogMonoTime - rlog_lastTsExternal >= 1000000 * 1000 * 0.99 && obj.GpsLocationExternal !== undefined) {
              logger.info(`processSegmentRLog GpsLocationExternal @ ${obj.LogMonoTime}: ${obj.GpsLocationExternal.Latitude} ${obj.GpsLocationExternal.Longitude}`);

              if (rlog_prevLatExternal != -1000) {
                var lat1 = rlog_prevLatExternal;
                var lat2 = obj.GpsLocationExternal.Latitude;
                var lon1 = rlog_prevLngExternal;
                var lon2 = obj.GpsLocationExternal.Longitude;
                var p = 0.017453292519943295; // Math.PI / 180
                var c = Math.cos;
                var a = 0.5 - c((lat2 - lat1) * p) / 2
                  + c(lat1 * p) * c(lat2 * p)
                  * (1 - c((lon2 - lon1) * p)) / 2;

                var dist_m = 1000 * 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
                if (dist_m > 70) dist_m = 0; // each segment is max. 60s. if the calculated speed would exceed ~250km/h for this segment, we assume the coordinates off / defective and skip it
                rlog_totalDistExternal += dist_m;
              }
              rlog_prevLatExternal = obj.GpsLocationExternal.Latitude;
              rlog_prevLngExternal = obj.GpsLocationExternal.Longitude;
              rlog_lastTsExternal = obj.LogMonoTime;
            }
            else if (obj.LogMonoTime !== undefined && obj.CarParams !== undefined && rlog_CarParams == null) {
              rlog_CarParams = obj.CarParams;
            }
            else if (obj.LogMonoTime !== undefined && obj.InitData !== undefined && rlog_InitData == null) {
              rlog_InitData = obj.InitData;
            }
          } catch (exception) {

          }
        });
      } catch (readerERr) {
        throw new Error('reader Err 385', readerEEr);
      }
    }
  );
}

function processSegmentVideo(qcameraPath) {
  qcamera_duration = 0;
  return new Promise((resolve, reject) => {
    ffprobe(qcameraPath, { path: ffprobeStatic.path })
      .then((info) => {
        if (info.streams !== undefined && info.streams[0] !== undefined && info.streams[0].duration !== undefined) {
          qcamera_duration = info.streams[0].duration;
        }
        logger.info(`processSegmentVideo duration: ${qcamera_duration}s`);
        resolve();
      })
      .catch((err) => {
        console.error(err);
        logger.error(`processSegmentVideo error: ${err}`);
        resolve();
      });
  });
}

function processSegmentsRecursive() {
  if (segmentProcessQueue.length <= segmentProcessPosition) {
    return updateDrives();
  }

  var segmentWrapper = segmentProcessQueue[segmentProcessPosition];
  const { segment } = segmentWrapper;

  const { uploadComplete } = segmentWrapper;
  const { driveIdentifier } = segmentWrapper;
  const { fileStatus } = segmentWrapper;

  logger.info(`processSegmentsRecursive ${segment.dongle_id} ${segment.drive_identifier} ${segment.segment_id} ${JSON.stringify(segment)}`);

  const driveSegmentResult = dbProtectedRun(
    'UPDATE drive_segments SET process_attempts = ? WHERE id = ?',

    segment.process_attempts = segment.process_attempts + 1,
    segment.id
  );

  if (segment.process_attempts > 5) {
    logger.error(`FAILING TO PROCESS SEGMENT,${segment.dongle_id} ${segment.drive_identifier} ${segment.segment_id} JSON: ${JSON.stringify(segment)} SKIPPING `);
    segmentProcessPosition++;
  }
  else {

    var p1 = processSegmentRLog(fileStatus['rlog.bz2']);
    var p2 = processSegmentVideo(fileStatus['qcamera.ts']);
    Promise.all([p1, p2])
      .then((values) => {
        (async () => {
          logger.info(`processSegmentsRecursive ${segment.dongle_id} ${segment.drive_identifier} ${segment.segment_id} internal gps: ${Math.round(rlog_totalDistInternal * 100) / 100}m, external gps: ${Math.round(rlog_totalDistExternal * 100) / 100}m, duration: ${qcamera_duration}s`);

          const driveSegmentResult = await orm.models.drive_segments.update({
            duration: qcamera_duration, 
            distance_meters: Math.round(Math.max(rlog_totalDistInternal, rlog_totalDistExternal) * 10) / 10, 
            is_processed: true, 
            upload_complete: uploadComplete, 
            is_stalled: false

          }, {where: {id: segment.id}})


          if (driveSegmentResult === null) // if the update failed, stop right here with segment processing and try to update the drives at least
          {
            segmentProcessPosition = segmentProcessQueue.length;
          }

          affectedDrives[driveIdentifier] = true;
          if (rlog_CarParams != null) {
            affectedDriveCarParams[driveIdentifier] = rlog_CarParams;
          }
          if (rlog_InitData != null) {
            affectedDriveInitData[driveIdentifier] = rlog_InitData;
          }

          segmentProcessPosition++;
          setTimeout(() => {
            processSegmentsRecursive();
          }, 0);
        })();
      })
      .catch((error) => {
        logger.error(error);
      });
  }

}

async function updateSegments() {
  segmentProcessQueue = [];
  segmentProcessPosition = 0;
  affectedDrives = {};
  affectedDriveCarParams = {};
  affectedDriveInitData = {};

  const drive_segments = await dbProtectedAll('SELECT * FROM drive_segments WHERE upload_complete = ? AND is_stalled = ? AND process_attempts < ? ORDER BY created ASC', false, false, 5);
  if (drive_segments != null) {
    for (var t = 0; t < drive_segments.length; t++) {
      var segment = drive_segments[t];

      var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
        .update(segment.dongle_id)
        .digest('hex');
      var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt)
        .update(segment.drive_identifier)
        .digest('hex');

      const directoryTree = dirTree(`${config.storagePath + segment.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${segment.drive_identifier}/${segment.segment_id}`);
      if (directoryTree == null || directoryTree.children == undefined) continue; // happens if upload in progress (db entity written but directory not yet created)

      var qcamera = false;
      var fcamera = false;
      var dcamera = false;
      var qlog = false;
      var rlog = false;
      var fileStatus = {
        'fcamera.hevc': false,
        'dcamera.hevc': false,
        'qcamera.ts': false,
        'qlog.bz2': false,
        'rlog.bz2': false
      };

      for (var i in directoryTree.children) {
        fileStatus[directoryTree.children[i].name] = directoryTree.children[i].path;
      }

      var uploadComplete = false;
      if (fileStatus['qcamera.ts'] !== false && fileStatus['fcamera.hevc'] !== false && fileStatus['rlog.bz2'] !== false && fileStatus['qlog.bz2'] !== false) // upload complete
      {
        uploadComplete = true;
      }

      if (fileStatus['qcamera.ts'] !== false && fileStatus['rlog.bz2'] !== false && !segment.is_processed) { // can process
        segmentProcessQueue.push({
          segment,
          fileStatus,
          uploadComplete,
          driveIdentifier: `${segment.dongle_id}|${segment.drive_identifier}`
        });
      }
      else if (uploadComplete) {
        logger.info(`updateSegments uploadComplete for ${segment.dongle_id} ${segment.drive_identifier} ${segment.segment_id}`);

        const driveSegmentResult = await dbProtectedRun(
          'UPDATE drive_segments SET upload_complete = ?, is_stalled = ? WHERE id = ?',
          true,

          false,

          segment.id
        );

        affectedDrives[`${segment.dongle_id}|${segment.drive_identifier}`] = true;
      }
      else if (Date.now() - segment.created > 10 * 24 * 3600 * 1000) { // ignore non-uploaded segments after 10 days until a new upload_url is requested (which resets is_stalled)
        logger.info(`updateSegments isStalled for ${segment.dongle_id} ${segment.drive_identifier} ${segment.segment_id}`);

        const driveSegmentResult = await dbProtectedRun(
          'UPDATE drive_segments SET is_stalled = ? WHERE id = ?',
          true,

          segment.id
        );
      }

      if (segmentProcessQueue.length >= 15) // we process at most 15 segments per batch
      {
        break;
      }
    }
  }

  if (segmentProcessQueue.length > 0) {
    processSegmentsRecursive();
  }
  else // if no data is to be collected, call updateDrives to update those where eventually just the last segment completed the upload
  {
    updateDrives();
  }
}

async function updateDevices() {
  // go through all affected devices (with deleted or updated drives) and update them (storage_used)
  logger.info(`updateDevices - affected drives: ${JSON.stringify(affectedDevices)}`);
  for (const [key, value] of Object.entries(affectedDevices)) {
    var dongleId = key;

    const device = await dbProtectedGet('SELECT * FROM devices WHERE dongle_id = ?', dongleId);
    if (device == null) continue;

    var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(device.dongle_id)
      .digest('hex');
    var devicePath = `${config.storagePath + device.dongle_id}/${dongleIdHash}`;
    var deviceQuotaMb = Math.round(parseInt(execSync(`du -s ${devicePath} | awk -F'\t' '{print $1;}'`)
      .toString()) / 1024);
    logger.info(`updateDevices device ${dongleId} has an updated storage_used of: ${deviceQuotaMb} MB`);

    const deviceResult = await orm.models.drives.update(
      {storage_used: deviceQuotaMb},
      {where: {dongle_id: device.dongle_id}}
      )


  }
  affectedDevices = [];
}

async function updateDrives() {
  // go through all affected drives and update them / complete and/or build m3u8
  logger.info(`updateDrives - affected drives: ${JSON.stringify(affectedDrives)}`);
  for (const [key, value] of Object.entries(affectedDrives)) {
    var dongleId,
      driveIdentifier;
    [dongleId, driveIdentifier] = key.split('|');
    let drive = await orm.models.drives({where: {driveIdentifier: driveIdentifier, dongleId: dongleId}})
    if (drive == null) continue;
    drive = drive.dataValues;
    var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(drive.dongle_id)
      .digest('hex');
    var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(drive.identifier)
      .digest('hex');
    var driveUrl = `${config.baseDriveDownloadUrl + drive.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${drive.identifier}`;
    var drivePath = `${config.storagePath + drive.dongle_id}/${dongleIdHash}/${driveIdentifierHash}/${drive.identifier}`;

    var uploadComplete = true;
    var isProcessed = true;

    var totalDistanceMeters = 0;
    var totalDurationSeconds = 0;
    var playlistSegmentStrings = '';

    const drive_segments= await orm.models.drive_segments.findAll({
      where: {
        drive_identifier: driveIdentifier,
        dongle_id: dongleId
      },
      order: [
        sequelize.fn('ASC', sequelize.col('segment_id')),
      ]
    })

    if (drive_segments != null) {
      for (var t = 0; t < drive_segments.length; t++) {
        if (!drive_segments[t].upload_complete) uploadComplete = false;
        if (!drive_segments[t].is_processed) {
          isProcessed = false;
        }
        else {
          totalDistanceMeters += parseFloat(drive_segments[t].distance_meters);
          totalDurationSeconds += parseFloat(drive_segments[t].duration);

          playlistSegmentStrings += `#EXTINF:${drive_segments[t].duration},${drive_segments[t].segment_id}\n${driveUrl}/${drive_segments[t].segment_id}/qcamera.ts\n`;
        }
      }
    }

    var { filesize } = drive;
    if (uploadComplete) {
      try {
        var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
          .update(dongleId)
          .digest('hex');
        var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt)
          .update(driveIdentifier)
          .digest('hex');
        filesize = parseInt(execSync(`du -s ${drivePath} | awk -F'\t' '{print $1;}'`)
          .toString()); // in kilobytes
      } catch (exception) { }
    }

    let metadata = {};
    try {
      metadata = JSON.parse(drive.metadata);
    } catch (exception) {
      logger.error(exception);
    }
    if (metadata == null) metadata = {};

    if (affectedDriveInitData[key] != undefined && metadata.InitData == undefined) {
      metadata.InitData = affectedDriveInitData[key];
    }
    if (affectedDriveCarParams[key] != undefined && metadata.CarParams == undefined) {
      metadata.CarParams = affectedDriveCarParams[key];
    }

    logger.info(`updateDrives drive ${dongleId} ${driveIdentifier} uploadComplete: ${uploadComplete}`);

    const driveResult = await orm.models.drives.update(
      {distance_meters: Math.round(totalDistanceMeters), 
        duration: totalDurationSeconds,
        upload_complete: uploadComplete,
        is_processed: isProcessed,
        filesize,
        metadata:JSON.stringify(metadata)
      },
      {where: {id: drive.id}}
    )


    affectedDevices[dongleId] = true;

    if (isProcessed) {
      // create the playlist file m3u8 for cabana
      var playlist = '#EXTM3U\n'
        + '#EXT-X-VERSION:3\n'
        + '#EXT-X-TARGETDURATION:61\n'
        + '#EXT-X-MEDIA-SEQUENCE:0\n'
        + `#EXT-X-PLAYLIST-TYPE:VOD\n${playlistSegmentStrings}\n`
        + '#EXT-X-ENDLIST';

      fs.writeFileSync(`${drivePath}/qcamera.m3u8`, playlist);
    }
  }

  updateDevices();

  setTimeout(() => {
    mainWorkerLoop();
  }, 0);
}

async function deleteExpiredDrives() {
  var expirationTs = Date.now() - config.deviceDriveExpirationDays * 24 * 3600 * 1000;

  const expiredDrives = await dbProtectedAll('SELECT * FROM drives WHERE is_preserved = ? AND is_deleted = ? AND created < ?', false, false, expirationTs);
  if (expiredDrives != null) {
    for (var t = 0; t < expiredDrives.length; t++) {
      logger.info(`deleteExpiredDrives drive ${expiredDrives[t].dongle_id} ${expiredDrives[t].identifier} is older than ${config.deviceDriveExpirationDays} days, set is_deleted=true`);
      const driveResult = await orm.models.drives.update({
        is_deleted: true
      },
      {where: {id: expiredDrives[t].id}})
      
    }
  }
}

async function removeDeletedDrivesPhysically() {
  const deletedDrives = await dbProtectedAll('SELECT * FROM drives WHERE is_deleted = ? AND is_physically_removed = ?', true, false);
  if (deletedDrives == null) {
    return;
  }
  for (var t = 0; t < deletedDrives.length; t++) {
    logger.info(`removeDeletedDrivesPhysically drive ${deletedDrives[t].dongle_id} ${deletedDrives[t].identifier} is deleted, remove physical files and clean database`);

    var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(deletedDrives[t].dongle_id)
      .digest('hex');
    var driveIdentifierHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(deletedDrives[t].identifier)
      .digest('hex');

    const drivePath = `${config.storagePath + deletedDrives[t].dongle_id}/${dongleIdHash}/${driveIdentifierHash}`;
    logger.info(`removeDeletedDrivesPhysically drive ${deletedDrives[t].dongle_id} ${deletedDrives[t].identifier} storage path is ${drivePath}`);
    try {
      const driveResult = await dbProtectedRun(
        'UPDATE drives SET is_physically_removed = ? WHERE id = ?',
        true,

        deletedDrives[t].id
      );

      const driveSegmentResult = await dbProtectedRun(
        'DELETE FROM drive_segments WHERE drive_identifier = ? AND dongle_id = ?',
        deletedDrives[t].identifier,

        deletedDrives[t].dongle_id
      );

      if (driveResult != null && driveSegmentResult != null) deleteFolderRecursive(drivePath, { recursive: true });
      affectedDevices[deletedDrives[t].dongle_id] = true;
    } catch (exception) {
      logger.error(exception);
    }
  }
}

async function deleteOverQuotaDrives() {
  const devices = await dbProtectedAll('SELECT * FROM devices WHERE storage_used > ?', config.deviceStorageQuotaMb);
  if (devices == null) {
    return;
  }

  for (var t = 0; t < devices.length; t++) {
    var foundDriveToDelete = false;

    const driveNormal = await dbProtectedGet('SELECT * FROM drives WHERE dongle_id = ? AND is_preserved = ? AND is_deleted = ? ORDER BY created ASC LIMIT 1', devices[t].dongle_id, false, false);
    if (driveNormal != null) {
      logger.info(`deleteOverQuotaDrives drive ${driveNormal.dongle_id} ${driveNormal.identifier} (normal) is deleted for over-quota`);
      const driveResult = await dbProtectedRun(
        'UPDATE drives SET is_deleted = ? WHERE id = ?',
        true,

        driveNormal.id
      );
      foundDriveToDelete = true;
    }

    if (!foundDriveToDelete) {
      const drivePreserved = await dbProtectedGet('SELECT * FROM drives WHERE dongle_id = ? AND is_preserved = ? AND is_deleted = ? ORDER BY created ASC LIMIT 1', devices[t].dongle_id, true, false);
      if (drivePreserved != null) {
        logger.info(`deleteOverQuotaDrives drive ${drivePreserved.dongle_id} ${drivePreserved.identifier} (preserved!) is deleted for over-quota`);
        const driveResult = await dbProtectedRun(
          'UPDATE drives SET is_deleted = ? WHERE id = ?',
          true,

          drivePreserved.id
        );
        foundDriveToDelete = true;
      }
    }
  }
}

async function deleteBootAndCrashLogs() {
  const devices = await dbProtectedAll('SELECT * FROM devices');
  if (devices == null) {
    return;
  }

  for (var t = 0; t < devices.length; t++) {
    var device = devices[t];
    var dongleIdHash = crypto.createHmac('sha256', config.applicationSalt)
      .update(device.dongle_id)
      .digest('hex');

    const bootlogDirectoryTree = dirTree(`${config.storagePath + device.dongle_id}/${dongleIdHash}/boot/`, { attributes: ['size'] });
    var bootlogFiles = [];
    if (bootlogDirectoryTree != undefined) {
      for (var i = 0; i < bootlogDirectoryTree.children.length; i++) {
        var timeSplit = bootlogDirectoryTree.children[i].name.replace('boot-', '')
          .replace('crash-', '')
          .replace('\.bz2', '')
          .split('--');
        var timeString = `${timeSplit[0]} ${timeSplit[1].replace(/-/g, ':')}`;
        bootlogFiles.push({
          name: bootlogDirectoryTree.children[i].name,
          size: bootlogDirectoryTree.children[i].size,
          date: Date.parse(timeString),
          path: bootlogDirectoryTree.children[i].path
        });
      }
      bootlogFiles.sort((a, b) => ((a.date < b.date) ? 1 : -1));
      for (var c = 5; c < bootlogFiles.length; c++) {
        logger.info(`deleteBootAndCrashLogs deleting boot log ${bootlogFiles[c].path}`);
        try {
          fs.unlinkSync(bootlogFiles[c].path);
          affectedDevices[device.dongle_id] = true;
        } catch (exception) {
          logger.error(exception);
        }
      }
    }

    const crashlogDirectoryTree = dirTree(`${config.storagePath + device.dongle_id}/${dongleIdHash}/crash/`, { attributes: ['size'] });
    var crashlogFiles = [];
    if (crashlogDirectoryTree != undefined) {
      for (var i = 0; i < crashlogDirectoryTree.children.length; i++) {
        var timeSplit = crashlogDirectoryTree.children[i].name.replace('boot-', '')
          .replace('crash-', '')
          .replace('\.bz2', '')
          .split('--');
        var timeString = `${timeSplit[0]} ${timeSplit[1].replace(/-/g, ':')}`;
        crashlogFiles.push({
          name: crashlogDirectoryTree.children[i].name,
          size: crashlogDirectoryTree.children[i].size,
          date: Date.parse(timeString),
          path: crashlogDirectoryTree.children[i].path
        });
      }
      crashlogFiles.sort((a, b) => ((a.date < b.date) ? 1 : -1));
      for (var c = 5; c < crashlogFiles.length; c++) {
        logger.info(`deleteBootAndCrashLogs deleting crash log ${crashlogFiles[c].path}`);
        try {
          fs.unlinkSync(crashlogFiles[c].path);
          affectedDevices[device.dongle_id] = true;
        } catch (exception) {
          logger.error(exception);
        }
      }
    }
  }
}

async function mainWorkerLoop() {
  if (Date.now() - startTime > 60 * 60 * 1000) {
    logger.info('EXIT WORKER AFTER 1 HOUR TO PREVENT MEMORY LEAKS...');
    process.exit();
  }

  try {
    if (Date.now() - lastCleaningTime > 20 * 60 * 1000) {
      await deleteBootAndCrashLogs();
      await deleteExpiredDrives();
      await deleteOverQuotaDrives();
      await removeDeletedDrivesPhysically();
      lastCleaningTime = Date.now();
    }

    setTimeout(() => {
      updateSegments();
    }, 5000);
  } catch (e) {
    logger.error(e);
  }
}

// make sure bunzip2 is available
try {
  //execSync('bunzip2 --help');
} catch (exception) {
  logger.error('bunzip2 is not installed or not available in environment path');
  process.exit();
}

lockfile.lock('retropilot_worker.lock', {
    realpath: false,
    stale: 90000,
    update: 2000
  })
  .then((release) => {
    logger.info('STARTING WORKER...');
    (async () => {
      try {
        db = await open({
          filename: config.databaseFile,
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READWRITE
        });
        await db.get('SELECT * FROM accounts LIMIT 1');
        await db.get('SELECT * FROM devices LIMIT 1');
        await db.get('SELECT * FROM drives LIMIT 1');
        await db.get('SELECT * FROM drive_segments LIMIT 1');
      } catch (exception) {
        logger.error(exception);
        process.exit();
      }

      initializeStorage();
      setTimeout(() => {
        mainWorkerLoop();
      }, 0);
    })();
  })
  .catch((e) => {
    console.error(e);
    process.exit();
  });
