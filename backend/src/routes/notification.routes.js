const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');
const { verifyJWT } = require('../middleware/auth.middleware');

router.use(verifyJWT);

router.get('/', ctrl.getAll);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);

module.exports = router;
