const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/maintenance.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createMaintenancePlanSchema, updateMaintenancePlanSchema } = require('../validators/maintenance.validator');

router.use(verifyJWT);

router.get('/', requirePermission('maintenance:read'), ctrl.getAll);
router.get('/calendar', requirePermission('maintenance:read'), ctrl.getCalendar);
router.post('/', requirePermission('maintenance:create'), validate(createMaintenancePlanSchema), auditLog('create', 'maintenance_plan'), ctrl.create);
router.patch('/:id', requirePermission('maintenance:update'), validate(updateMaintenancePlanSchema), auditLog('update', 'maintenance_plan'), ctrl.update);

module.exports = router;
