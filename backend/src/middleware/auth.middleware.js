const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/errors');

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(unauthorized('Missing or invalid authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      org_id: decoded.org_id,
      full_name: decoded.full_name,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired'));
    }
    return next(unauthorized('Invalid token'));
  }
}

module.exports = { verifyJWT };
