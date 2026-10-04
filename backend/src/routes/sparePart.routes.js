const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sparePart.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createSparePartSchema, updateSparePartSchema } = require('../validators/sparePart.validator');

router.use(verifyJWT);

router.get('/', requirePermission('maintenance:read'), ctrl.getAll);
router.post('/', requirePermission('maintenance:create'), validate(createSparePartSchema), auditLog('create', 'spare_part'), ctrl.create);
router.patch('/:id', requirePermission('maintenance:update'), validate(updateSparePartSchema), auditLog('update', 'spare_part'), ctrl.update);

module.exports = router;
