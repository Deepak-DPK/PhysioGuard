const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ai.controller');
const { verifyJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { validate } = require('../middleware/validate.middleware');
const { auditLog } = require('../middleware/audit.middleware');
const { upload } = require('../middleware/upload.middleware');
const { predictFailureSchema, rulSchema, anomalySchema, reviewAISchema, summariseSchema } = require('../validators/ai.validator');

router.use(verifyJWT);

router.post('/predict-failure', requirePermission('ai:execute'), validate(predictFailureSchema), ctrl.predictFailure);
router.post('/rul', requirePermission('ai:execute'), validate(rulSchema), ctrl.estimateRUL);
router.post('/anomaly', requirePermission('ai:execute'), validate(anomalySchema), ctrl.detectAnomalies);
router.post('/recognise-defect', requirePermission('ai:execute'), upload.single('image'), ctrl.recogniseDefect);
router.post('/summarise-notes', requirePermission('ai:execute'), validate(summariseSchema), ctrl.summariseNotes);
router.post('/:runId/review', requirePermission('ai:review'), validate(reviewAISchema), auditLog('review', 'ai_run'), ctrl.reviewAIRun);
router.get('/runs', requirePermission('ai:read'), ctrl.getRuns);

module.exports = router;
