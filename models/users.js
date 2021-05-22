let db;

async function userPing(email) {
    return await db.run('UPDATE accounts SET last_ping = ? WHERE email = ?', Date.now(), email);
}

async function getAccountFromEmail(email) {
    return await db.get('SELECT * FROM accounts WHERE LOWER(email) = ?', email);

}



module.exports = (_db) => {
    db = _db;

    return {
        userPing,
        getAccountFromEmail
    }
}