/* eslint-disable no-restricted-syntax */
function formatDuration(durationSeconds) {
  const durationSecondsRound = Math.round(durationSeconds);
  const secs = durationSecondsRound % 60;
  let mins = Math.floor(durationSecondsRound / 60);
  let hours = Math.floor(mins / 60);
  mins %= 60;
  const days = Math.floor(hours / 24);
  hours %= 24;

  let response = '';
  if (days > 0) response += `${days}d `;
  if (hours > 0 || days > 0) response += `${hours}h `;
  if (hours > 0 || days > 0 || mins > 0) response += `${mins}m `;
  response += `${secs}s`;
  return response;
}

// TODO remove this - looks like its used in old server.js
function simpleStringify(object) {
  const simpleObject = {};
  for (const prop in object) {
    if (!object.hasOwnProperty(prop)) {
      continue;
    }
    if (typeof (object[prop]) === 'object') {
      continue;
    }
    if (typeof (object[prop]) === 'function') {
      continue;
    }
    simpleObject[prop] = object[prop];
  }
  return JSON.stringify(simpleObject); // returns cleaned up JSON
}

function formatDate(timestampMs) {
  return new Date(timestampMs).toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

module.exports = {
  formatDuration, simpleStringify, formatDate,
};
