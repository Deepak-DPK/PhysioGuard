const { z } = require('zod');

const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['therapy_bed', 'electrotherapy_unit', 'exercise_equipment', 'mobility_aid', 'treatment_room']),
  location_id: z.string().uuid().optional(),
  serial_number: z.string().max(100).optional(),
  model: z.string().max(200).optional(),
  manufacturer: z.string().max(200).optional(),
  install_date: z.string().datetime().optional(),
  warranty_expiry: z.string().datetime().optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  owner_id: z.string().uuid().optional(),
  runtime_hours: z.number().min(0).default(0),
  notes: z.string().max(2000).optional(),
}).strict();

const updateAssetSchema = createAssetSchema.partial().strict();

module.exports = { createAssetSchema, updateAssetSchema };
