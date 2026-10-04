const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

function auditLog(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      const entityId = req.params.id || data?.data?.id || null;
      supabase
        .from('audit_logs')
        .insert({
          org_id: req.user?.org_id,
          user_id: req.user?.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          outcome: res.statusCode < 400 ? 'success' : 'failure',
        })
        .then()
        .catch((err) => logger.error({ err }, 'Failed to write audit log'));

      return originalJson(data);
    };
    next();
  };
}

module.exports = { auditLog };
