import { z } from 'zod';
import { SimulationConfigSchema } from './configuration.schema.js';

export const CreateSimulationRequestSchema = SimulationConfigSchema;

export const UpdateSimulationConfigRequestSchema = SimulationConfigSchema.partial();

export const SimulationResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  protocol: z.string(),
  status: z.string(),
  current_time: z.number(),
  max_simulation_time: z.number(),
  random_seed: z.number().nullable(),
  config: z.record(z.any()),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date()),
});

export const StepSimulationRequestSchema = z.object({
  delta_time_us: z.number().positive().optional(),
  step_count: z.number().int().positive().optional().default(1),
});

