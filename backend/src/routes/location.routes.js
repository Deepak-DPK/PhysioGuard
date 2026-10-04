const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/location.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createLocationSchema, updateLocationSchema } = require('../validators/location.validator');

router.use(verifyJWT);

router.get('/', requirePermission('assets:read'), ctrl.getAll);
router.post('/', requirePermission('assets:create'), validate(createLocationSchema), auditLog('create', 'location'), ctrl.create);
router.patch('/:id', requirePermission('assets:update'), validate(updateLocationSchema), auditLog('update', 'location'), ctrl.update);
router.delete('/:id', requirePermission('assets:delete'), auditLog('delete', 'location'), ctrl.remove);

module.exports = router;
