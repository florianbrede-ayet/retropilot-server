const deviceController = require('../../controllers/devices');

let wss;

async function getDongleOwners(dongle_id) {
  const owners = await deviceController.getOwnersFromDongle(dongle_id);
  console.log('dongle owners', owners);
  return owners;
}

async function broadcastToAccounts(owners, data) {
  wss.clients.forEach((ws) => {
    owners.data.forEach((account_id) => {
      if (account_id === ws.account.id) {
        ws.send(JSON.stringify(data));
      }
    });
  });
}

async function dongleStatus(dongle_id, status) {
  const owners = await getDongleOwners(dongle_id);
  await broadcastToAccounts(owners, { command: 'dongle_status', id: Date.now(), data: { dongle_id, online: status, time: Date.now() } });
}

async function passData(dongle_id, msg) {
  const owners = await getDongleOwners(dongle_id);
  await broadcastToAccounts(owners, { command: 'data_return', id: msg.id, data: { dongle_id, return: msg } });
  return true;
}

module.exports = (websocket) => {
  wss = websocket;

  return {
    getDongleOwners,
    dongleStatus,
    passData,
  };
};
