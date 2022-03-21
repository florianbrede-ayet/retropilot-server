import 'dotenv/config';
import request from 'supertest';

import app from '../src/server/app';

// TODO better way to only run tests once server is up
describe('loading express', () => {
  it('responds to /', (done) => {
    request(app)
      .get('/')
      .expect(200, done);
  });
  it('404 everything else', (done) => {
    request(app)
      .get('/foo/bar')
      .expect(404, done);
  });
});

require('./routes/api.test')(app);
require('./routes/useradmin.test')(app);
if (process.env.USE_USER_ADMIN_API) require('./routes/userAdminApi.test')(app);
