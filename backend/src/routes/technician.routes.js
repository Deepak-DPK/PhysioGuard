const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/technician.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(verifyJWT);

router.get('/', requirePermission('technicians:read'), ctrl.getAll);
router.get('/queue', requirePermission('technicians:read'), ctrl.getQueue);

module.exports = router;
