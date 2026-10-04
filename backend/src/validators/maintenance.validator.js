const { z } = require('zod');

const createMaintenancePlanSchema = z.object({
  asset_id: z.string().uuid(),
  name: z.string().min(1).max(300),
  frequency_days: z.number().int().min(1),
  required_skill: z.string().max(200).optional(),
  estimated_hours: z.number().min(0).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
}).strict();

const updateMaintenancePlanSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  frequency_days: z.number().int().min(1).optional(),
  required_skill: z.string().max(200).optional(),
  estimated_hours: z.number().min(0).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
}).strict();

const createInspectionSchema = z.object({
  asset_id: z.string().uuid(),
  checklist: z.array(z.object({
    item: z.string(),
    passed: z.boolean(),
    notes: z.string().optional(),
  })),
  findings: z.string().max(5000).optional(),
}).strict();

module.exports = { createMaintenancePlanSchema, updateMaintenancePlanSchema, createInspectionSchema };
