import request from 'supertest';
import server from '../server';

// TODO better way to only run tests once server is up
describe('loading express', () => {
  it('responds to /', (done) => {
    request(server)
      .get('/')
      .expect(200, done);
  });
  it('404 everything else', (done) => {
    request(server)
      .get('/foo/bar')
      .expect(404, done);
  });
});

require('./routes/api.test')(server);
require('./routes/useradmin.test')(server);
if (process.env.USE_USER_ADMIN_API) require('./routes/userAdminApi.test')(server);
