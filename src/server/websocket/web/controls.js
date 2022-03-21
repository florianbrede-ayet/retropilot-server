import deviceController from '../../controllers/devices';

let wss;

async function getDongleOwners(dongleId) {
  const owners = await deviceController.getOwnersFromDongle(dongleId);
  console.log('dongle owners', owners);
  return owners;
}

async function broadcastToAccounts(owners, data) {
  wss.clients.forEach((ws) => {
    owners.data.forEach((accountId) => {
      if (accountId === ws.account.id) {
        ws.send(JSON.stringify(data));
      }
    });
  });
}

async function dongleStatus(dongleId, status) {
  const owners = await getDongleOwners(dongleId);
  await broadcastToAccounts(owners, {
    command: 'dongle_status',
    id: Date.now(),
    data: {
      dongle_id: dongleId,
      online: status,
      time: Date.now(),
    },
  });
}

async function passData(dongleId, msg) {
  const owners = await getDongleOwners(dongleId);
  await broadcastToAccounts(owners, {
    command: 'data_return',
    id: msg.id,
    data: {
      dongle_id: dongleId,
      return: msg,
    },
  });
  return true;
}

export default (websocket) => {
  wss = websocket;

  return {
    getDongleOwners,
    dongleStatus,
    passData,
  };
};
