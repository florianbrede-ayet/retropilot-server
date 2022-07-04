/*
    Pair a comma EON to authenticated user's account.
*/

import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next'
import { Secret, verify } from '../../../lib/jwt';
import prisma from '../../../lib/prisma';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const {
        imei,
        imei2,
        public_key,
        register_token,
        serial
    } = req.query as {[key: string] : any};

    const tokenValidation = await verify(register_token, public_key as Secret);

    if(!tokenValidation || !imei || !serial) {
        return res.status(400).send('Invalid JWT.');
    }

    const existingDevice = await prisma.devices.findFirst({where: {serial}});

    if(existingDevice) {
        return res.status(200).json({ first_pair: false, dongle_id: existingDevice.dongle_id });
    } else {
        const device = await prisma.devices.create({data: {
            dongle_id: randomUUID(),
            imei,
            serial,
            device_type: 'freon',
            public_key,
            created: Date.now(),
            last_ping: Date.now(),
            storage_used: 0,
        }});

        return res.status(200).json({ dongle_id: device.dongle_id, access_token: 'DEPRECATED-BUT-REQUIRED-FOR-07' });
    }
}