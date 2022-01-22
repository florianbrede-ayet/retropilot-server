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

router.get('/authentication/twofactor/enrol', isAuthenticated, async (req, res) => {

});

export default router;
