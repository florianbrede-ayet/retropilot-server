/*
    Request a URL to which an openpilot file can be uploaded via PUT request.
    This endpoint only accepts tokens signed with a device private key (openpilot 0.6.3 and newer.)
*/

import type { NextApiRequest, NextApiResponse } from 'next'
import { sha256 } from 'js-sha256';
import prisma from '../../../lib/prisma';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    let { path, dongle_id } = <{ path: string, dongle_id: string }>req.query;

    const device = await prisma.devices.findFirst({where: {dongle_id}});
    if(!device) return res.status(404).send('Not found.');

    const ts = Date.now();
    const dongle_hash: string = sha256.hmac.create(process.env.APP_SALT as string).update(dongle_id as string).hex();
    let upload_directory: string = `${dongle_id}/${dongle_hash}/`;
    let upload_filename: string;
    let upload_token: string;

    if (path.indexOf('boot/') === 0 || path.indexOf('crash/') === 0 || path.indexOf('bootlog.bz2') > 0) {
        if (path && path.indexOf('bootlog.bz2') > 0) { // pre-op 0.8 way of uploading bootlogs
            // file 2020-09-30--08-09-13--0/bootlog.bz2 to something like: boot/2021-05-11--03-03-38.bz2
            let chunks = path.split('--');
            path = `boot/${chunks[0]}--${chunks[1]}.bz2`;
        }

        console.log('Upload url for boot file');

        // TODO, allow multiple types
        const upload_type = path.indexOf('boot/') === 0 ? 'boot' : 'crash';

        upload_directory += `${upload_type}`;
        upload_filename = path.replace('/', '-');
    } else {
        // "2021-04-12--01-44-25--0/qlog.bz2" for example
        const [
            ,
            drive_identifier,
            ,
            ,
            ,
            ,
            ,
            ,
            segment,
            filename
        ] = <string[]>path.split(/((\d{4})-(\d{2})-(\d{2})--(\d{2})-(\d{2})-(\d{2}))--(\d+)\/(\w+\.bz2)/)

        const VALID_FILES = ['fcamera.hevc', 'qcamera.ts', 'dcamera.hevc', 'rlog.bz2', 'qlog.bz2', 'ecamera.hevc'];
        if (VALID_FILES.indexOf(filename) === -1 || Number.isNaN(segment)) {
            console.log(filename, segment, VALID_FILES.indexOf(filename) === -1, Number.isNaN(segment));
            return res.status(400).send('Malformed Request.');
        }

        const drive_hash: string = sha256.hmac.create(process.env.APP_SALT as string).update(drive_identifier).hex();

        upload_directory += `${drive_hash}/${drive_identifier}/${segment}`;
        upload_filename = filename;

        const existing_drive = await prisma.drives.findFirst({where: {dongle_id, identifier: drive_identifier}});

        if(existing_drive) {
            await prisma.drives.update({
                where: {dongle_id, identifier: drive_identifier},
                data: {
                    max_segment: Math.max(existing_drive.max_segment ?? 0, parseInt(segment)),
                    upload_complete: false,
                    is_processed: false,
                    last_upload: Date.now(),
                }
            });
        } else {
            await prisma.drives.create({
                data: {
                    dongle_id,
                    identifier: drive_identifier,
                    max_segment: parseInt(segment),
                    upload_complete: false,
                    is_processed: false,
                    last_upload: Date.now(),
                }
            });
        }

        const existing_segment = await prisma.drive_segments.findFirst({
            where: {dongle_id, segment_id: parseInt(segment), drive_identifier}
        });

        if(!existing_segment) {
            await prisma.drive_segments.create({
                data: {
                    dongle_id,
                    drive_identifier,
                    segment_id: parseInt(segment),
                    duration: 0,
                    distance_meters: 0,
                    upload_complete: false,
                    is_processed: false,
                    is_stalled: false,
                }
            });
        }
    }

    upload_token = sha256.hmac.create(process.env.APP_SALT as string).update(dongle_id + upload_filename + ts).hex();

    return res.status(200).json({
        url: `${process.env.BASE_UPLOAD_URL}?filename=${upload_filename}&dir=${upload_directory}&dongle_id=${dongle_id}&ts=${ts}&token=${upload_token}`
    });
}