const express = require('express');
const router = express.Router();
const { login, refresh, logout } = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate.middleware');
const { verifyJWT } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { loginSchema, refreshSchema } = require('../validators/auth.validator');

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', verifyJWT, logout);

module.exports = router;
