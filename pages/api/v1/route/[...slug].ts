//GET /v1/route/:route_name/segments
//GET /v1/route/:route_name/files
//GET /v1/route/:route_name/files/qlog
import type { NextApiRequest, NextApiResponse } from 'next'
import GET_route_name_files from './GET_route_name_files';
import GET_route_name_files_qlog from './GET_route_name_files_qlog';
import GET_route_name_segments from './GET_route_name_segments';

export default (req: NextApiRequest, res: NextApiResponse) => {
    const { slug } = req.query;
    req.query = {...req.query, route_name: slug?.[0]};

    const switchCase = slug?.[1];

    if(req.method === 'GET') {
        switch(switchCase) {
            case 'segments':
                GET_route_name_segments(req, res);
            break;
            case 'files':
                if(slug?.[3] === 'qlog') GET_route_name_files_qlog(req, res);
                else GET_route_name_files(req, res);
            break;
        }
    }
}