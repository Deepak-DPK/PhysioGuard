const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/workOrder.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { upload } = require('../middleware/upload.middleware');
const { createWorkOrderSchema, updateWorkOrderSchema, reviewWorkOrderSchema } = require('../validators/workOrder.validator');

router.use(verifyJWT);

router.get('/', requirePermission('work_orders:read'), ctrl.getAll);
router.get('/:id', requirePermission('work_orders:read'), ctrl.getById);
router.post('/', requirePermission('work_orders:create'), validate(createWorkOrderSchema), auditLog('create', 'work_order'), ctrl.create);
router.patch('/:id', requirePermission('work_orders:update'), validate(updateWorkOrderSchema), auditLog('update', 'work_order'), ctrl.update);
router.post('/:id/approve', requirePermission('work_orders:approve'), validate(reviewWorkOrderSchema), auditLog('approve', 'work_order'), ctrl.approve);
router.post('/:id/reject', requirePermission('work_orders:approve'), validate(reviewWorkOrderSchema), auditLog('reject', 'work_order'), ctrl.reject);
router.post('/:id/close', requirePermission('work_orders:close'), auditLog('close', 'work_order'), ctrl.close);
router.post('/:id/evidence', requirePermission('work_orders:update'), upload.single('file'), ctrl.uploadEvidence);

module.exports = router;
