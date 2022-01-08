const router = require('express').Router();
const bodyParser = require('body-parser');
const config = require('../../config');

const authenticationController = require('../../controllers/authentication');
const userController = require('../../controllers/users');

async function isAuthenticated(req, res, next) {
  const account = await authenticationController.getAuthenticatedAccount(req, res);

  if (account === null) {
    res.json({
      success: true,
      data: {
        authenticated: false,
      },
    });
  } else {
    req.account = account;
    next();
  }
}

router.get('/retropilot/0/useradmin/session', isAuthenticated, async (req, res) => {
  const account = await authenticationController.getAccountFromJWT(req.cookies.jwt, true);

  if (account) {
    return res.json({
      success: true,
      data: {
        authenticated: true,
        user: account.dataValues,
      },
    });
  }

  return res.json({
    success: true,
    data: {
      authenticated: false,
    },
  });
});

router.post('/retropilot/0/useradmin/auth', bodyParser.urlencoded({ extended: true }), async (req, res) => {
  const signIn = await authenticationController.signIn(req.body.email, req.body.password);

  if (signIn.success) {
    res.cookie('jwt', signIn.jwt);

    const account = await authenticationController.getAccountFromJWT(signIn.jwt, true);

    res.json({
      success: true,
      data: {
        authenticated: true,
        jwt: signIn.jwt,
        user: account.dataValues,
      },
    });
  } else {
    res.json({
      success: true,
      data: {
        authenticated: false,
      },
    });
  }
});

router.get('/retropilot/0/useradmin/signout', async (req, res) => {
  res.clearCookie('session');
  return res.json({ success: true });
});

router.get('/session/get', async (req, res) => {
  const account = await authenticationController.getAuthenticatedAccount(req, res);

  if (!account) {
    res.json({ success: true, hasSession: false, session: {} });
  } else {
    res.json({ success: true, hasSession: false, session: account });
  }
});

module.exports = router;
