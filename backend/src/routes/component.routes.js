const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/component.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createComponentSchema, updateComponentSchema } = require('../validators/assetChildren.validator');

// Mounted at the API root; JWT is applied per route so unmatched paths are unaffected.
router.get('/assets/:assetId/components', verifyJWT, requirePermission('assets:read'), ctrl.getByAsset);
router.post('/assets/:assetId/components', verifyJWT, requirePermission('assets:update'), validate(createComponentSchema), auditLog('create', 'asset_component'), ctrl.create);
router.patch('/components/:id', verifyJWT, requirePermission('assets:update'), validate(updateComponentSchema), auditLog('update', 'asset_component'), ctrl.update);
router.delete('/components/:id', verifyJWT, requirePermission('assets:update'), auditLog('delete', 'asset_component'), ctrl.remove);

module.exports = router;
