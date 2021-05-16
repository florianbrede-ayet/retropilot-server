# retropilot-server
replacement for comma.ai backend and useradmin dashboard. can be combined with a modified cabana instance.

### [Server] Summary

The server consists of 2 node scripts. 
`server.js` is using expressjs and runs the backend (file upload / communication with openpilot) and the useradmin dashboard to manage / view / download drives & logs.
`worker.js` is a background worker that is processing drives (analyzing video files & logs) to prepare drives for playback in cabana and to gather statistics. It automatically terminates itself after 60 minutes to make sure the video/log libraries do not cause memory leaks.

Both scripts can be started with a cronjob each minute, they use locking to make sure they run exclusively.


### [Server] Installation

```
npm install
cp config.sample.js config.js
> EDIT config.js
```


### [Server] Running

```
node server.js
```
```
node worker.js
```


### [Server] CABANA Support
Currently, cabana support is enabled through a custom cabana fork that is requesting drive information from retropilot-server and uses the `demo.js` structure from cabana to load a drive. At the moment, this limits some features like sharing (sharing the URL will publicly share a drive) and also limits caching / automatically selecting the correct `dbc`.

To setup a cusom cabana server, check this repository and set the correct cabana url in `config.js`:
https://github.com/florianbrede-ayet/retropilot-cabana

-----


### Preparing OpenPilot Device

#### Option (a) By modying endpoint URL in OpenPilot
The only replacement required in code is in `common/api/__init__.py`:
```
def api_get(endpoint, method='GET', timeout=None, access_token=None, **params):
  backend = "https://api.commadotai.com/" # replace with the RetroPilot server
```

#### Option (b) Without code changes (not functional yet)


### Re-Registering OpenPilot Device
To re-register a freon previously registered on comma or a different server, you have to remove the old `dongleId` and reboot:
```
rm /data/params/d/DongleID
reboot
```


### Current Limitations
Right now, the OpenPilot dashboard does not display any statistics or pairing status.
The reason is that at least pre 0.8.3, the `offroad.apk` with react and comma-api is for some reason either ignoring `/etc/hosts` changes or not accepting the certificate from *Preparing > Option b)*.

Right now statistics are only available through the *RetroPilot Useradmin*, the beauty however is that the Pairing-QR-Code is always available so it's easy to unpair and repair the device to a different account on the RetroPilot Server.



### Screenshots

![image](https://user-images.githubusercontent.com/48515354/118385101-6bd64780-b60c-11eb-899d-bcb0b32e2939.png)

![image](https://user-images.githubusercontent.com/48515354/118385092-4ba68880-b60c-11eb-987e-2ca801b56caa.png)

![image](https://user-images.githubusercontent.com/48515354/118385075-2a459c80-b60c-11eb-976c-bc331a609391.png)

![image](https://user-images.githubusercontent.com/48515354/118385084-37fb2200-b60c-11eb-8d3e-6db458827808.png)
