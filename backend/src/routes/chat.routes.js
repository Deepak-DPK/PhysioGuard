const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth.middleware');
const { chat, getSuggestions } = require('../controllers/chat.controller');

router.post('/', verifyJWT, chat);
router.get('/suggestions', verifyJWT, getSuggestions);

module.exports = router;
