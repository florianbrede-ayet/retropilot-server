/*
    Returns an object representing a comma device.

    Response

    Key	Type	Description
    "dongle_id"	(string)	see Dongle ID
    "alias"	(string)	Globally unique device nickname
    "serial"	(string)	Device serial
    "athena_host"	(string)	Last connected athena server
    "last_athena_ping"	(integer)	Timestamp of last athena ping
    "ignore_uploads"	(bool)	If uploads are ignored
    "is_paired"	(bool)	Device has an owner
    "is_owner"	(bool)	Authed user has write-access to device
    "public_key"	(string)	2048-bit public RSA key
    "prime"	(bool)	If device has prime
    "prime_type"	(integer)	Prime type: 0: no prime, 1: standard prime, 2: prime lite
    "trial_claimed"	(bool)	If device prime trial is claimed
    "device_type"	(string)	one of ("neo", "panda", "app")
    "last_gps_time"	(integer)	Milliseconds since epoch of last gps. Updates upon successful call to device location endpoint
    "last_gps_lat"	(float)	Latitude of last location
    "last_gps_lng"	(float)	Longitude of last location
    "last_gps_accuracy"	(float)	Accuracy (m) of last location
    "last_gps_speed"	(float)	Speed (m/s) at last location
    "last_gps_bearing"	(float)	Direction of last location in degrees from north
    "openpilot_version"	(string)	Last known openpilot version on device
    "sim_id"	(string)	Last known sim_id of SIM in device
*/

import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../lib/prisma';


// TODO: user guard and filter by account
export default async (req: NextApiRequest, res: NextApiResponse) => {
    const device = await prisma.devices.findFirst({where: {dongle_id: req.query.dongle_id as string}});
    if(device) {
        res.status(200).json(
            {
                dongle_id: device.dongle_id,
                alias: device.nickname,
                serial: device.serial,
                athena_host: null, // TODO: Last connected athena server
                last_athena_ping: null, // TODO: Timestamp of last athena ping
                ignore_uploads: device.ignore_uploads,
                is_paired: device.account_id !== null,
                is_owner: true, // TODO: 2048-bit public RSA key
                public_key: device.public_key,
                prime: false, // TODO: If device has prime
                prime_type: 0, // TODO: Prime type: 0: no prime, 1: standard prime, 2: prime lite
                trial_claimed: false, // TODO: If device prime trial is claimed
                device_type: device.device_type,
                last_gps_time: 0, // TODO: Milliseconds since epoch of last gps. Updates upon successful call to device location endpoint
                last_gps_long: 0, // TODO: Longitude of last location
                last_gps_lat: 0, // TODO: Latitude of last location
                last_gps_accuracy: 0, // TODO: Accuracy (m) of last location
                last_gps_speed: 0, // TODO: Speed (m/s) at last location
                last_gps_bearing: 0, // TODO: Direction of last location in degrees from north
                openpilot_version: null, // TODO: Last known openpilot version on device
                sim_id: null // TODO: Last known sim_id of SIM in device
            }
        );
    } else return res.status(404).json({error: 'NotFound'});
}