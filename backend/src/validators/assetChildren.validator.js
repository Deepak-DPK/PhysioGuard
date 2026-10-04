const { z } = require('zod');

const createComponentSchema = z.object({
  name: z.string().min(1).max(200),
  part_number: z.string().max(100).optional(),
  install_date: z.string().datetime().optional(),
  expected_life_hours: z.number().min(0).optional(),
  status: z.string().max(20).optional(),
}).strict();
const updateComponentSchema = createComponentSchema.partial().strict();

const createWarrantySchema = z.object({
  vendor: z.string().max(200).optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  coverage_details: z.string().max(5000).optional(),
  document_url: z.string().url().optional(),
}).strict();
const updateWarrantySchema = createWarrantySchema.partial().strict();

const createMeterSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  type: z.enum(['meter', 'sensor']),
}).strict();
const updateMeterSchema = createMeterSchema.partial().strict();

const meterReadingSchema = z.object({
  value: z.number(),
  timestamp: z.string().datetime().optional(),
  raw: z.record(z.any()).optional(),
}).strict();

const createServiceHistorySchema = z.object({
  work_order_id: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
  performed_by: z.string().uuid().optional(),
  performed_at: z.string().datetime().optional(),
  cost: z.number().min(0).optional(),
}).strict();

module.exports = {
  createComponentSchema, updateComponentSchema,
  createWarrantySchema, updateWarrantySchema,
  createMeterSchema, updateMeterSchema, meterReadingSchema,
  createServiceHistorySchema,
};
