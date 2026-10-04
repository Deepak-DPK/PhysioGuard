const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { logger } = require('./utils/logger');
const { supabase } = require('./config/supabase');
const { AppError } = require('./utils/errors');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

app.get('/api/v1/health', async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const { error } = await supabase.from('organisations').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', database: 'connected', timestamp });
  } catch (err) {
    logger.error({ err: err.message }, 'Health check database failure');
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp });
  }
});

const routes = require('./routes');
app.use('/api/v1', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, _next) => {
  if (err instanceof AppError) {
    logger.warn({ err: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  logger.error({ err });
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
