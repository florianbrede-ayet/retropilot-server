/* eslint-disable global-require */
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const config = require('../config');

async function validateDatabase(db, logger) {
  try {
    db = await open({
      filename: config.databaseFile,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE,
    });
    await db.get('SELECT * FROM accounts LIMIT 1');
    await db.get('SELECT * FROM devices LIMIT 1');
    await db.get('SELECT * FROM drives LIMIT 1');
    await db.get('SELECT * FROM drive_segments LIMIT 1');
  } catch (exception) {
    logger.error(exception);
    process.exit();
  }
}

module.exports = async () => ({
  models: {},

});
