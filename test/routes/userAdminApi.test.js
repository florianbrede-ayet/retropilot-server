const request = require('supertest');
const dummyGenerator = require('./../dummyGenerator');
let app;



module.exports = (server) => {
    app = server;

    describe('/api', function() {
        it('Load general server stats', function (done) {
            request(server)
                .get('/retropilot/0/useradmin')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect((req) => {
                    const body = req.body;

                    try {
                        if (
                            body.hasOwnProperty('success') && body.success === true &&
                            body.hasOwnProperty('data')  &&
                            body.data.hasOwnProperty('serverStats') &&
                            body.data.serverStats.hasOwnProperty('config') &&
                            typeof body.data.serverStats.config.registerAllowed === "boolean" &&
                            typeof body.data.serverStats.config.welcomeMessage === "string" &&
                            typeof body.data.serverStats['accounts'] === "number" &&
                            typeof body.data.serverStats['devices'] === "number" &&
                            typeof body.data.serverStats['drives'] === "number" &&
                            (typeof body.data.serverStats['storageUsed'] === "number" || body.data.serverStats['storageUsed'] === "Unsupported Platform"))
                        {
                            return true;
                        } else {
                            throw new Error('Invalid returned parameters in GET /retropilot/0/useradmin')
                        }
                    } catch (exception) {
                        throw new Error('Invalid returned parameters in GET /retropilot/0/useradmin ')
                    }
                })
                .end(done)
        });


    });

}
