import express from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { getURL, getToken } from '../../../controllers/authentication/oauth/google';
import authenticationController from '../../../controllers/authentication';

const router = express.Router();

async function isAuthenticated(req, res, next) {
  const account = await authenticationController.getAuthenticatedAccount(req);

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

router.get('/authentication/oauth/callback', async (req, res) => {
  console.log(req.query);

  res.json(await getToken(req.query.code, req.query.scope));
});

router.get('/authentication/oauth/:provider', async (req, res) => {
  const { provider } = req.params;
  console.log('provider', provider);
  let url;
  switch (provider) {
    case 'google':
      url = await getURL();
      break;
    default:
      url = false;
      break;
  }

  if (url) {
    res.redirect(url);
  } else {
    res.json({ error: true, msg: 'Invalid provider' });
  }
});

router.get('/authentication/oauth/pair/:provider', isAuthenticated, async (req, res) => {
  


});

export default router;
