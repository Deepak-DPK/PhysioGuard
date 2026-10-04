const { ROLE_PERMISSIONS } = require('../config/constants');
const { forbidden } = require('../utils/errors');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('You do not have the required role for this action'));
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(forbidden());
    const perms = ROLE_PERMISSIONS[req.user.role] || [];
    if (!perms.includes(permission)) {
      return next(forbidden(`Missing permission: ${permission}`));
    }
    next();
  };
}

module.exports = { requireRole, requirePermission };
