
const jwt = require('jsonwebtoken');



async function validateJWT(token, key) {
    try {
        return jwt.verify(token.replace("JWT ", ""), key, {algorithms: ['RS256']});
    } catch (exception) {
        // TODO add logger to authentication controller
        //logger.error(exception);
    }
    return null;
}


module.exports = {
    validateJWT: validateJWT
}
