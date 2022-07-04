//POST /v1/:dongle_id/upload_urls/
import type { NextApiRequest, NextApiResponse } from 'next'
import POST_dongle_id_upload_urls from './POST_dongle_id_upload_urls';

export default (req: NextApiRequest, res: NextApiResponse) => {
    const { slugs } = req.query;
    req.query = {...req.query, dongle_id: slugs?.[0]};

    const switchCase = slugs?.[1];

    if(req.method === 'POST') {
        switch(switchCase) {
            case 'upload_urls':
                POST_dongle_id_upload_urls(req, res);
            break;
        }
    }
}