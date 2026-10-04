const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inspection.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createInspectionSchema } = require('../validators/maintenance.validator');

router.use(verifyJWT);

router.get('/', requirePermission('inspections:read'), ctrl.getAll);
router.post('/', requirePermission('inspections:create'), validate(createInspectionSchema), auditLog('create', 'inspection'), ctrl.create);

module.exports = router;
