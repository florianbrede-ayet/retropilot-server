import request from 'supertest';

export default (app) => {
  describe('/api', function () {
    it('Load general app stats', function (done) {
      request(app)
        .get('/retropilot/0/useradmin')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect((req) => {
          const body = req.body;

          try {
            if (
              body.hasOwnProperty('success') && body.success === true &&
              body.hasOwnProperty('data') &&
              body.data.hasOwnProperty('appStats') &&
              body.data.appStats.hasOwnProperty('config') &&
              typeof body.data.appStats.config.registerAllowed === 'boolean' &&
              typeof body.data.appStats.process.env.WELCOME_MESSAGE === 'string' &&
              typeof body.data.appStats['accounts'] === 'number' &&
              typeof body.data.appStats['devices'] === 'number' &&
              typeof body.data.appStats['drives'] === 'number' &&
              (typeof body.data.appStats['storageUsed'] === 'number' || body.data.appStats['storageUsed'] === 'Unsupported Platform')) {
              return true;
            }
          } catch (ignored) {
          }
          throw new Error('Invalid returned parameters in GET /retropilot/0/useradmin ');
        })
        .end(done);
    });
  });
};
