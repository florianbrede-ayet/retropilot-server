/*

*/

import type { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) => {
    res.status(200).json(
        {
             "url": "https://commaincoming.blob.core.windows.net/commaincoming/239e82a1d3c855f2/2019-06-06--11-30-31/9/fcamera.hevc?sr=b&sp=c&sig=cMCrZt5fje7SDXlKcOIjHgA0wEVAol71FL6ac08Q2Iw%3D&sv=2018-03-28&se=2019-06-13T18%3A43%3A01Z"
        }
    );
}