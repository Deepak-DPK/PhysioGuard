const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/serviceHistory.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createServiceHistorySchema } = require('../validators/assetChildren.validator');

router.get('/assets/:assetId/service-history', verifyJWT, requirePermission('assets:read'), ctrl.getByAsset);
router.post('/assets/:assetId/service-history', verifyJWT, requirePermission('maintenance:create'), validate(createServiceHistorySchema), auditLog('create', 'service_history'), ctrl.create);

module.exports = router;
