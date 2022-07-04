//GET /v1.4/:dongle_id/upload_url/
import type { NextApiRequest, NextApiResponse } from 'next'
import GET_dongle_id_upload_url from './GET_dongle_id_upload_url'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { slugs } = req.query;
    req.query = {...req.query, dongle_id: slugs?.[0]};

    const switchCase = slugs?.[1];
    if(req.method === 'GET') {
        switch(switchCase) {
            case 'upload_url':
                return await GET_dongle_id_upload_url(req, res);
                break;
        }
    }

    return res.status(404).send('Not found.');
}