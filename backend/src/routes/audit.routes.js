const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/audit.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(verifyJWT);

router.get('/', requirePermission('audit:read'), ctrl.getAll);
router.get('/system-config', requirePermission('settings:read'), ctrl.getSystemConfig);
router.patch('/system-config/:key', requirePermission('settings:update'), ctrl.updateSystemConfig);

module.exports = router;
