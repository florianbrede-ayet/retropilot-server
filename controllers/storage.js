const config = require('./../config');
const path = require('path');
const fs = require('fs')

let models;
let logger;

let totalStorageUsed;

function initializeStorage() {
    var verifiedPath = mkDirByPathSync(config.storagePath, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (verifiedPath != null)
        logger.info("Verified storage path " + verifiedPath);
    else {
        logger.error("Unable to verify storage path '" + config.storagePath + "', check filesystem / permissions");
        process.exit();
    }
}

function mkDirByPathSync(targetDir, {isRelativeToScript = false} = {}) {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';

    // TODO does this break anything? Commented out code will create a folder in the /controllers directory, defined __basedir as a global var in server.js
    const baseDir =  __basedir; //isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(baseDir, parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
        } catch (err) {
            console.debug(err);
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


function writeFileSync(path, buffer, permission) {
    let fileDescriptor;
    try {
        fileDescriptor = fs.openSync(path, 'w', permission);
    } catch (e) {
        fs.chmodSync(path, permission);
        fileDescriptor = fs.openSync(path, 'w', permission);
    }

    if (fileDescriptor) {
        fs.writeSync(fileDescriptor, buffer, 0, buffer.length, 0);
        fs.closeSync(fileDescriptor);
        logger.info("writeFileSync wiriting to '" + path + "' successful");
        return true;
    }
    logger.error("writeFileSync writing to '" + path + "' failed");
    return false;
}

function moveUploadedFile(buffer, directory, filename) {
    logger.info(`moveUploadedFile called with ${filename} -> ${directory}'`);

    if (directory.indexOf("..") >= 0 || filename.indexOf("..") >= 0) {
        logger.error("moveUploadedFile failed, .. in directory or filename");
        return false;
    }

    if (config.storagePath.lastIndexOf("/") !== config.storagePath.length - 1)
        directory = '/' + directory;
    if (directory.lastIndexOf("/") !== directory.length - 1)
        directory = directory + '/';

    const finalPath = mkDirByPathSync(config.storagePath + directory, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (finalPath && finalPath.length > 0) {
        if (writeFileSync(finalPath + "/" + filename, buffer, 0o660)) {
            logger.info("moveUploadedFile successfully written '" + (finalPath + "/" + filename) + "'");
            return finalPath + "/" + filename;
        }
        logger.error("moveUploadedFile failed to writeFileSync");
        return false;
    }
    logger.error("moveUploadedFile invalid final path, check permissions to create / write '" + (config.storagePath + directory) + "'");
    return false;
}


async function updateTotalStorageUsed() {
    const verifiedPath = mkDirByPathSync(config.storagePath, {isRelativeToScript: (config.storagePath.indexOf("/") === 0 ? false : true)});
    if (verifiedPath !== null) {
        try {
            totalStorageUsed = execSync("du -hs " + verifiedPath + " | awk -F'\t' '{print $1;}'").toString();
        } catch (exception) {
            totalStorageUsed = "Unsupported Platform";
            logger.debug(`Unable to calculate storage used, only supported on systems with 'du' available`)
        }
    }
    setTimeout(function () {
        updateTotalStorageUsed();
    }, 120000); // update the used storage each 120 seconds
}

async function getTotalStorageUsed() {
    return totalStorageUsed;
}


module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        initializeStorage, mkDirByPathSync, writeFileSync, moveUploadedFile, updateTotalStorageUsed, getTotalStorageUsed
    }
}
