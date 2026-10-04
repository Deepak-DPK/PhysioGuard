const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/user.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');

router.use(verifyJWT);

router.get('/', requirePermission('users:read'), ctrl.getAll);
router.post('/', requirePermission('users:create'), validate(createUserSchema), auditLog('create', 'user'), ctrl.create);
router.patch('/:id', requirePermission('users:update'), validate(updateUserSchema), auditLog('update', 'user'), ctrl.update);
router.delete('/:id', requirePermission('users:delete'), auditLog('delete', 'user'), ctrl.remove);

module.exports = router;
