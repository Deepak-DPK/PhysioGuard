const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/report.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');

router.use(verifyJWT);

router.get('/asset-health', requirePermission('reports:read'), ctrl.assetHealth);
router.get('/downtime', requirePermission('reports:read'), ctrl.downtime);
router.get('/maintenance-effectiveness', requirePermission('reports:read'), ctrl.maintenanceEffectiveness);
router.get('/model-performance', requirePermission('reports:read'), ctrl.modelPerformance);
router.post('/export', requirePermission('reports:export'), ctrl.exportReport);

module.exports = router;
