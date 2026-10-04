const { z } = require('zod');

const createWorkOrderSchema = z.object({
  asset_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  type: z.enum(['preventive', 'corrective', 'emergency']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigned_to: z.string().uuid().optional(),
  skill_required: z.string().max(200).optional(),
  estimated_downtime_hours: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
}).strict();

const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'assigned', 'in_progress', 'pending_review', 'approved', 'rejected', 'closed']).optional(),
  assigned_to: z.string().uuid().optional(),
  skill_required: z.string().max(200).optional(),
  estimated_downtime_hours: z.number().min(0).optional(),
  actual_downtime_hours: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
  parts_used: z.array(z.object({ part_id: z.string(), quantity: z.number() })).optional(),
}).strict();

const reviewWorkOrderSchema = z.object({
  reason: z.string().min(1).max(1000),
}).strict();

module.exports = { createWorkOrderSchema, updateWorkOrderSchema, reviewWorkOrderSchema };
