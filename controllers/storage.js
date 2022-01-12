import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import log4js from 'log4js';
import config from '../config.js';

const logger = log4js.getLogger('default');

let totalStorageUsed;

function initializeStorage() {
  const verifiedPath = mkDirByPathSync(config.storagePath, { isRelativeToScript: (config.storagePath.indexOf('/') !== 0) });
  if (verifiedPath != null) {
    logger.info(`Verified storage path ${verifiedPath}`);
  } else {
    logger.error(`Unable to verify storage path '${config.storagePath}', check filesystem / permissions`);
    process.exit();
  }
}

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const { sep } = path;
  const initDir = path.isAbsolute(targetDir) ? sep : '';

  const baseDir = isRelativeToScript ? global.__basedir : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      // console.debug(err);
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

function writeFileSync(filePath, buffer, permission) {
  let fileDescriptor;
  try {
    fileDescriptor = fs.openSync(filePath, 'w', permission);
  } catch (e) {
    fs.chmodSync(filePath, permission);
    fileDescriptor = fs.openSync(filePath, 'w', permission);
  }

  if (!fileDescriptor) {
    logger.error(`writeFileSync writing to '${filePath}' failed`);
    return false;
  }

  fs.writeSync(fileDescriptor, buffer, 0, buffer.length, 0);
  fs.closeSync(fileDescriptor);
  logger.info(`writeFileSync wiriting to '${filePath}' successful`);
  return true;
}

function moveUploadedFile(buffer, directory, filename) {
  logger.info(`moveUploadedFile called with ${filename} -> ${directory}'`);

  if (directory.indexOf('..') >= 0 || filename.indexOf('..') >= 0) {
    logger.error('moveUploadedFile failed, .. in directory or filename');
    return false;
  }

  if (config.storagePath.lastIndexOf('/') !== config.storagePath.length - 1) {
    directory = `/${directory}`;
  }
  if (directory.lastIndexOf('/') !== directory.length - 1) {
    directory += '/';
  }

  const finalPath = mkDirByPathSync(config.storagePath + directory, { isRelativeToScript: (config.storagePath.indexOf('/') !== 0) });
  if (!finalPath || finalPath.length === 0) {
    logger.error(`moveUploadedFile invalid final path, check permissions to create / write '${config.storagePath + directory}'`);
    return false;
  }

  if (!writeFileSync(`${finalPath}/${filename}`, buffer, 0o660)) {
    logger.error('moveUploadedFile failed to writeFileSync');
    return false;
  }

  logger.info(`moveUploadedFile successfully written '${finalPath}/${filename}'`);
  return `${finalPath}/${filename}`;
}

async function updateTotalStorageUsed() {
  const verifiedPath = mkDirByPathSync(config.storagePath, { isRelativeToScript: (config.storagePath.indexOf('/') !== 0) });
  if (!verifiedPath) {
    return;
  }

  try {
    totalStorageUsed = execSync(`du -hs ${verifiedPath} | awk -F'\t' '{print $1;}'`).toString();
  } catch (exception) {
    totalStorageUsed = 'Unsupported Platform';
    logger.debug('Unable to calculate storage used, only supported on systems with \'du\' available');
  }
}

async function getTotalStorageUsed() {
  return totalStorageUsed;
}

setInterval(updateTotalStorageUsed, 120000);

export default {
  initializeStorage,
  mkDirByPathSync,
  writeFileSync,
  moveUploadedFile,
  updateTotalStorageUsed,
  getTotalStorageUsed,
};
