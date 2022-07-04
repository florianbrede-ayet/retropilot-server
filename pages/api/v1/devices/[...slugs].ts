//GET /v1/devices/:dongle_id/location
//POST /v1/devices/:dongle_id/unpair
//POST /v1/devices/:dongle_id/add_user
//POST /v1/devices/:dongle_id/del_user
//GET /v1/devices/:dongle_id/users
//GET /v1/devices/:dongle_id/bootlogs
//GET /v1/devices/:dongle_id/crashlogs
//GET /v1/devices/:dongle_id/segments

import type { NextApiRequest, NextApiResponse } from 'next'
import GET_dongle_id_bootlogs from './GET_dongle_id_bootlogs';
import GET_dongle_id_crashlogs from './GET_dongle_id_crashlogs';
import GET_dongle_id_location from './GET_dongle_id_location';
import GET_dongle_id_segments from './GET_dongle_id_segments';
import GET_dongle_id_users from './GET_dongle_id_users';
import POST_dongle_id_add_user from './POST_dongle_id_add_user';
import POST_dongle_id_del_user from './POST_dongle_id_del_user';
import POST_dongle_id_unpair from './POST_dongle_id_unpair';

export default (req: NextApiRequest, res: NextApiResponse) => {
    const { slugs } = req.query;
    req.query = {...req.query, dongle_id: slugs?.[0]};

    const switchCase = slugs?.[1];

    if(req.method === 'POST') {
        switch(switchCase) {
            case 'unpair':
                POST_dongle_id_unpair(req, res);
                break;
            case 'add_user':
                POST_dongle_id_add_user(req, res);
                break;
            case 'del_user':
                POST_dongle_id_del_user(req, res);
                break;
        }
    }

    if(req.method === 'GET') {
        switch(switchCase) {
            case 'location':
                GET_dongle_id_location(req, res);
                break;
            case 'crashlogs':
                GET_dongle_id_crashlogs(req, res);
                break;
            case 'segments':
                GET_dongle_id_segments(req, res);
                break;
            case 'bootlogs':
                GET_dongle_id_bootlogs(req, res);
                break;
            case 'users':
                GET_dongle_id_users(req, res);
                break;
        }
    }
}