const { z } = require('zod');

const createTechnicianSchema = z.object({
  user_id: z.string().uuid(),
  skills: z.array(z.string().max(200)).default([]),
  certifications: z.array(z.string().max(200)).default([]),
  availability_status: z.enum(['available', 'busy', 'on_leave', 'unavailable']).default('available'),
}).strict();

const updateTechnicianSchema = createTechnicianSchema.partial().strict();

module.exports = { createTechnicianSchema, updateTechnicianSchema };
