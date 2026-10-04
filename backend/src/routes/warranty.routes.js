const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/warranty.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createWarrantySchema, updateWarrantySchema } = require('../validators/assetChildren.validator');

router.get('/assets/:assetId/warranties', verifyJWT, requirePermission('assets:read'), ctrl.getByAsset);
router.post('/assets/:assetId/warranties', verifyJWT, requirePermission('assets:update'), validate(createWarrantySchema), auditLog('create', 'warranty'), ctrl.create);
router.patch('/warranties/:id', verifyJWT, requirePermission('assets:update'), validate(updateWarrantySchema), auditLog('update', 'warranty'), ctrl.update);

module.exports = router;
