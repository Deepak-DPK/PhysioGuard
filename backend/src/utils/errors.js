class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

const badRequest = (msg, details) => new AppError(msg || 'Bad request', 400, details);
const unauthorized = (msg) => new AppError(msg || 'Unauthorized', 401);
const forbidden = (msg) => new AppError(msg || 'Forbidden', 403);
const notFound = (msg) => new AppError(msg || 'Not found', 404);
const conflict = (msg) => new AppError(msg || 'Conflict', 409);
const validationError = (msg, details) => new AppError(msg || 'Validation failed', 422, details);
const internal = (msg) => new AppError(msg || 'Internal server error', 500);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, validationError, internal };
