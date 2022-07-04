//POST /v1/:dongle_id/upload_urls/
import type { NextApiRequest, NextApiResponse } from 'next'
import GET_dongle_id_locations from './GET_dongle_id_locations';
import GET_dongle_id_next from './GET_dongle_id_next';
import PUT_dongle_id_locations from './PUT_dongle_id_locations';

export default (req: NextApiRequest, res: NextApiResponse) => {
    const { slugs } = req.query;
    req.query = {...req.query, dongle_id: slugs?.[0]};

    const switchCase = slugs?.[1];

    if(req.method === 'GET') {
        switch(switchCase) {
            case 'locations':
                GET_dongle_id_locations(req, res);
                break;
            case 'next':
                GET_dongle_id_next(req, res);
                break;
        }
    }

    if(req.method === 'PUT') {
        switch(switchCase) {
            case 'locations':
                PUT_dongle_id_locations(req, res);
            break;
        }
    }
}