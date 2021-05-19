


let db;

function getDrives(dongleId) {

}

async function getDevice(dongleId) {
    return await db.get('SELECT * FROM devices WHERE dongle_id = ?', dongleId);
}

async function deviceCheckIn(dongleId) {
    await db.run(
        'UPDATE devices SET last_ping = ? WHERE dongle_id = ?',
        Date.now(), dongle_id
    );
}

module.exports = (_db) => {
    db = _db;

    return {
        getDevice,
        deviceCheckIn
    }
}