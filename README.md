# retropilot-server

Replacement for comma.ai backend and useradmin dashboard. Bundled with a modified version of comma's cabana to allow viewing & analyzing drives.

If you don't want to host your own instance, check out https://api.retropilot.org/useradmin for a hosted version of the backend, useradmin and cabana.

## [Server] Summary

The server consists of 2 node scripts.

`server.js` is using expressjs and runs the backend (file upload / communication with openpilot) and the useradmin dashboard to manage / view / download drives & logs.
`worker.js` is a background worker that is processing drives (analyzing video files & logs) to prepare drives for playback in cabana and to gather statistics. It automatically terminates itself after 60 minutes to make sure the video/log libraries do not cause memory leaks.

Both scripts can be started with a cronjob each minute, they use locking to make sure they run exclusively.

**Attention:** Minimum required node version is **node 10**.

## [Server] Installation

There are two supported methods of installation. The first is manual installation: the dependencies and running the scripts on your machine. The second is to build and run the server as a Docker image - we can use Docker Compose to run the server and worker scripts and load our environment variables.

### Manual Installation

To begin, install the NPM dependencies and copy the template.

```sh
npm install
cp example.env .env
```

Edit `.env` as appropriate.

To start the services, run the following commands.

```sh
node -r esm -r dotenv/config server.js
node -r esm -r dotenv/config worker.js
```

### Docker Installation

Uses Docker Compose [(see docs)](https://docs.docker.com/compose/). Recommended for production environments.

To begin, copy the templates.

```sh
cp docker-compose.example.yml docker-compose.yml
cp production.example.env production.env
```

Edit `docker-compose.yml` and `production.env` as appropriate.

To start the services, run the following command.

```sh
# Builds, (re)creates and starts containers for a service.
# The --build flag tells Docker to build images before starting containers.
# The -d flag runs the containers in the background.
docker-compose up --build -d
```

To view the logs you can run the following command. Press CTRL-C to exit.

```sh
# Displays log output from services. The -f flag will follow new log output.
docker-compose logs -f
```

To start/stop the services you can run the following.

```sh
# Starts existing containers for a service.
docker-compose start [SERVICE...]

# Stops running containers without removing them.
docker-compose stop [SERVICE...]

# Stops containers and removes containers and networks created by up.
docker-compose down
```


## [Server] CABANA Support
A compiled version of a custom cabana fork (https://github.com/florianbrede-ayet/retropilot-cabana) is directly bundled in the `cabana/` subdirectory and will be served by the express app. After starting `server.js`, cabana is ready to use.

-----


## [Device] Preparation / Enable Custom Server

On the device or in your fork's code, replace all API endpoints with your own server endpoint. 
This could be executed directly on the device in the shell to use `https://api.retropilot.org` as backend:
```
find /data/openpilot -type f -exec sed -i 's/https:\/\/api.commadotai.com/https:\/\/api.retropilot.org/g' {} +
```

## [Device] Swapping Servers (Back)
To switch a device between different servers, you have to remove the old `DongleId` and reboot:
```
rm /data/params/d/DongleID
reboot
```

There is no need to backup the `DongleId`, as the new server will identify your device based on its imei, serial and public key.

## [Device] Raw Drives Not Uploading (fcamera & rlog)
1. Raw data is only uploaded if the device is sufficiently charged, not connected to an active panda (offroad) and there are no immediate files (boot, crash, qcamera, qlog) remaining.<br>
2. Your branch might have raw uploads disabled, check *Device Settings > Upload Raw Logs*.


If that doesn't help or the option is not available, try:

```
echo "1" > /data/params/d/IsUploadRawEnabled
echo "1" > /data/params/d/UploadRaw
reboot
```

-----


## Current Limitations
OpenPilot before 0.8.3 will not display any statistics or pairing status in the dashboard.
The reason is that pre 0.8.3, the `offroad.apk` with react and comma-api would require recompilation to accept the new endpoints.

The athena websockets interface is not implemented yet, so the comma app and athena specific remote control commands (including "upload on demand") are not functional as of now.


## Screenshots

![image](https://user-images.githubusercontent.com/48515354/118385101-6bd64780-b60c-11eb-899d-bcb0b32e2939.png)

![image](https://user-images.githubusercontent.com/48515354/118385092-4ba68880-b60c-11eb-987e-2ca801b56caa.png)

![image](https://user-images.githubusercontent.com/48515354/118385075-2a459c80-b60c-11eb-976c-bc331a609391.png)

![image](https://user-images.githubusercontent.com/48515354/118385084-37fb2200-b60c-11eb-8d3e-6db458827808.png)
