const { z } = require('zod');

const predictFailureSchema = z.object({
  asset_id: z.string().uuid(),
}).strict();

const rulSchema = z.object({
  asset_id: z.string().uuid(),
}).strict();

const anomalySchema = z.object({
  asset_id: z.string().uuid(),
  window_hours: z.number().int().min(1).max(720).default(24),
}).strict();

const reviewAISchema = z.object({
  decision: z.enum(['approved', 'rejected', 'overridden']),
  reason: z.string().min(1).max(2000),
}).strict();

const summariseSchema = z.object({
  asset_id: z.string().uuid(),
}).strict();

module.exports = { predictFailureSchema, rulSchema, anomalySchema, reviewAISchema, summariseSchema };
