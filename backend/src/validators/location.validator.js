const { z } = require('zod');

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  parent_id: z.string().uuid().optional(),
  floor: z.string().max(20).optional(),
  building: z.string().max(100).optional(),
}).strict();

const updateLocationSchema = createLocationSchema.partial().strict();

module.exports = { createLocationSchema, updateLocationSchema };
