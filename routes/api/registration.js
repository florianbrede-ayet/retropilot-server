const bodyParser = require('body-parser');
const router = require('express').Router();

const userController = require('../../controllers/users');

router.post('/retropilot/0/register/email', bodyParser.urlencoded({ extended: true }), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    // FIXME: use logger.warn
    console.error('/useradmin/register/token - Malformed Request!');
    return res.status(400).json({ success: false, msg: 'malformed request' });
  }

  const accountStatus = await userController.createAccount(req.body.email, req.body.password);
  if (accountStatus && accountStatus.status) {
    return res.status(accountStatus.status).json(accountStatus);
  }
  return res.status(500).json({ success: false, msg: 'contact server admin' });
});

router.get('/retropilot/0/register/verify/:token', bodyParser.urlencoded({ extended: true }), async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ success: false, status: 400, data: { missingToken: true } });
  }

  const verified = await userController.verifyEmailToken(req.params.token);

  if (verified && verified.status) {
    return res.status(verified.status).json(verified);
  }
  return res.status(500).json({ success: false, msg: 'contact server admin' });
});

module.exports = router;
