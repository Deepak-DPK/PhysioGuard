const { z } = require('zod');

const createDowntimeSchema = z.object({
  asset_id: z.string().uuid(),
  work_order_id: z.string().uuid().optional(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  reason: z.string().max(2000).optional(),
  cost_impact: z.number().min(0).optional(),
}).strict();

const updateDowntimeSchema = createDowntimeSchema.partial().strict();

module.exports = { createDowntimeSchema, updateDowntimeSchema };
