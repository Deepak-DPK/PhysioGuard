const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/downtime.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createDowntimeSchema } = require('../validators/downtime.validator');

router.use(verifyJWT);

router.get('/', requirePermission('assets:read'), ctrl.getAll);
router.post('/', requirePermission('maintenance:create'), validate(createDowntimeSchema), ctrl.create);

module.exports = router;
