const request = require('supertest');
const dummyGenerator = require('./../dummyGenerator');
let app;



module.exports = (server) => {
    app = server;

    describe('/v2/pilotauth/ - Testing device registration', function() {
        it('Returns dongle ID on valid registration', function(done) {
            request(server)
                .post('/v2/pilotauth/')
                .query({
                    imei: dummyGenerator.getImei(),
                    serial: dummyGenerator.getSerial(),
                    public_key: dummyGenerator.devicePubKey,
                    register_token: dummyGenerator.makeJWT()
                })

                .set('Accept', 'application/x-www-form-urlencoded')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect((res) => {
                    if (!res.body.dongle_id) throw new Error("API Failed to return dongle_id on status 200")
                })
                .end(done)
        });

        it('Returns 400 when incorrect public key given', function(done) {
            request(server)
                .post('/v2/pilotauth/')
                .query({
                    imei: dummyGenerator.getImei(),
                    serial: dummyGenerator.getSerial(),
                    public_key: dummyGenerator.rougePublicKey,
                    register_token: dummyGenerator.makeJWT()
                })

                .set('Accept', 'application/x-www-form-urlencoded')
                .expect('Content-Type', /text/)
                .expect(400)
                .end(done)
        });

        it('Returns 400 when missing register_token', function(done) {
            request(server)
                .post('/v2/pilotauth/')
                .query({
                    imei: dummyGenerator.getImei(),
                    serial: dummyGenerator.getSerial(),
                    public_key: dummyGenerator.rougePublicKey,
                    register_token: ""
                })

                .set('Accept', 'application/x-www-form-urlencoded')
                .expect('Content-Type', /text/)
                .expect(400)
                .end(done)
        });

        it('Returns 400 when missing query', function(done) {
            request(server)
                .post('/v2/pilotauth/')

                .set('Accept', 'application/x-www-form-urlencoded')
                .expect('Content-Type', /text/)
                .expect(400)
                .end(done)
        });
    });


}
