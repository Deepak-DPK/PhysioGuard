const { z } = require('zod');

const createSparePartSchema = z.object({
  name: z.string().min(1).max(200),
  part_number: z.string().max(100).optional(),
  quantity_on_hand: z.number().int().min(0).default(0),
  min_quantity: z.number().int().min(0).default(0),
  supplier: z.string().max(200).optional(),
  unit_cost: z.number().min(0).optional(),
  location: z.string().max(200).optional(),
}).strict();

const updateSparePartSchema = createSparePartSchema.partial().strict();

module.exports = { createSparePartSchema, updateSparePartSchema };
