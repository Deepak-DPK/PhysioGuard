const { validationError } = require('../utils/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(validationError('Validation failed', details));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
