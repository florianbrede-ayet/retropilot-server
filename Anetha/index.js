const WebSocket = require('ws');
const fs = require('fs');
const cookie = require('cookie')
const jsonwebtoken = require('jsonwebtoken');


const authenticationController = require('./../controllers/authentication');
const deviceController = require('./../controllers/devices');

let wss; 

async function __server() {
  wss = new WebSocket.WebSocketServer({ path: '/ws/v2/', port: 4040 });
  console.log("src")

  

  wss.on('connection',  manageConnection)

}

const authenticateDongle = async (ws, res, cookies) => {
  unsafeJwt = jsonwebtoken.decode(cookies.jwt);
  const device = await deviceController.getDeviceFromDongle(unsafeJwt.identity)
    console.log(unsafeJwt)


    let verifiedJWT;

    try {
      verifiedJWT = jsonwebtoken.verify(cookies.jwt, device.public_key, {ignoreNotBefore: true});
    } catch (err) {
      console.log("bad JWT");
      return false;
    }

  
    if (verifiedJWT.identify === unsafeJwt.identify) {
        ws.dongleId = device.dongle_id
        console.log("AUTHENTICATED DONGLE")
        return true;
    } else {
        console.log("UNAUTHENTICATED DONGLE");
        return false;
    }
}


 function commandBuilder(method, params) {
  

  return {
    method,
    params,
    "jsonrpc": "2.0",
    "id": 0
  }

}





async function manageConnection(ws, res)  {
  ws.badMessages = 0;
  var cookies = cookie.parse(res.headers.cookie);


  ws.on('message', function incoming(message) {
    if (!ws.dongleId) { return null; console.log("unauthenticated message, discarded"); }

    console.log("unknown message", JSON.stringify(message))
  });

  
  if (await authenticateDongle(ws, res, cookies) === false) {
    ws.close();
  }

  //ws.send(JSON.stringify(await commandBuilder('reboot')))



  

}


__server();




function _findSocketFromDongle(dongleId) {

  let websocket = null;
  wss.clients.forEach((value) => {
    console.log(value.dongleId)

    if (value.dongleId === dongleId) {
      websocket = value;
    }

  })

  return websocket;
}





function rebootDevice(dongleId) {
  const websocket = _findSocketFromDongle(dongleId);

  if (!websocket) { return false; console.log("bad")}

  websocket.send(JSON.stringify(commandBuilder('reboot')))


}





module.exports = {
  rebootDevice
}
