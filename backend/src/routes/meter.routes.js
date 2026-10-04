const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/meter.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createMeterSchema, updateMeterSchema, meterReadingSchema } = require('../validators/assetChildren.validator');

router.get('/assets/:assetId/meters', verifyJWT, requirePermission('assets:read'), ctrl.getByAsset);
router.post('/assets/:assetId/meters', verifyJWT, requirePermission('assets:update'), validate(createMeterSchema), auditLog('create', 'meter'), ctrl.create);
router.patch('/meters/:id', verifyJWT, requirePermission('assets:update'), validate(updateMeterSchema), auditLog('update', 'meter'), ctrl.update);
router.post('/meters/:id/readings', verifyJWT, requirePermission('assets:update'), validate(meterReadingSchema), ctrl.postReading);

module.exports = router;
