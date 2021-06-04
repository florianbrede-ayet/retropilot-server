let models;
let logger;


function formatDuration(durationSeconds) {
    durationSeconds = Math.round(durationSeconds);
    const secs = durationSeconds % 60;
    let mins = Math.floor(durationSeconds / 60);
    let hours = Math.floor(mins / 60);
    mins = mins % 60;
    const days = Math.floor(hours / 24);
    hours = hours % 24;
    
    let response = '';
    if (days > 0) response += days + 'd ';
    if (hours > 0 || days > 0) response += hours + 'h ';
    if (hours > 0 || days > 0 || mins > 0) response += mins + 'm ';
    response += secs + 's';
    return response;
}


function simpleStringify(object) {
    let simpleObject = {};
    for (var prop in object) {
        if (!object.hasOwnProperty(prop)) {
            continue;
        }
        if (typeof (object[prop]) == 'object') {
            continue;
        }
        if (typeof (object[prop]) == 'function') {
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject); // returns cleaned up JSON
}


function formatDate(timestampMs) {
    return new Date(timestampMs).toISOString().replace(/T/, ' ').replace(/\..+/, '');
}



module.exports = (_models, _logger) => {
    models = _models;
    logger = _logger;

    return {
        formatDuration, simpleStringify, formatDate
    }
}
