const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1).max(200),
  role: z.enum(['maintenance_admin', 'technician', 'operations_manager', 'vendor']),
}).strict();

const updateUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  role: z.enum(['maintenance_admin', 'technician', 'operations_manager', 'vendor']).optional(),
  is_active: z.boolean().optional(),
}).strict();

module.exports = { createUserSchema, updateUserSchema };
