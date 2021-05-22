var server = require('./../server')
var request = require('supertest');

// TODO better way to only run tests once server is up
describe('loading express', function () {
    it('responds to /', function testSlash(done) {
        request(server)
            .get('/')
            .expect(200, done);
    });
    it('404 everything else', function testPath(done) {
        request(server)
            .get('/foo/bar')
            .expect(404, done);
    });
});




require('./routes/api.test')(server);
require('./routes/useradmin.test')(server);