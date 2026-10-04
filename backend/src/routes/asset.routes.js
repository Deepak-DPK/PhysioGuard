const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/asset.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createAssetSchema, updateAssetSchema } = require('../validators/asset.validator');

router.use(verifyJWT);

router.get('/', requirePermission('assets:read'), ctrl.getAll);
router.get('/:id', requirePermission('assets:read'), ctrl.getById);
router.post('/', requirePermission('assets:create'), validate(createAssetSchema), auditLog('create', 'asset'), ctrl.create);
router.patch('/:id', requirePermission('assets:update'), validate(updateAssetSchema), auditLog('update', 'asset'), ctrl.update);
router.delete('/:id', requirePermission('assets:delete'), auditLog('delete', 'asset'), ctrl.remove);
router.get('/:id/telemetry', requirePermission('assets:read'), ctrl.getTelemetry);
router.get('/:id/health-score', requirePermission('assets:read'), ctrl.getHealthScore);
router.get('/:id/work-orders', requirePermission('assets:read'), ctrl.getWorkOrders);
router.get('/:id/inspections', requirePermission('assets:read'), ctrl.getInspections);

module.exports = router;
