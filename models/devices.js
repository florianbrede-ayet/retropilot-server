let db;

async function getDeviceFromDongleId(email) {
  return await db.run('SELECT * FROM devices WHERE dongle_id', Date.now(), email);
}

module.exports = (_db) => {
  db = _db;

  return {
    userPing,
    getAccountFromEmail,
    createUser,
    getAccountFromId,
    getAccountFromVerifyToken,
    verifyAccountEmail,
    banAccount,
  };
};
