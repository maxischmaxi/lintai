import { z } from "zod";

export const RangeSchema = z.object({
  startLine: z.number().int().min(0),
  startCharacter: z.number().int().min(0),
  endLine: z.number().int().min(0),
  endCharacter: z.number().int().min(0),
});

export type Range = z.infer<typeof RangeSchema>;

export const FindingCategorySchema = z.enum([
  "smell",
  "practice",
  "spaghetti",
  "naming",
  "safety",
]);

export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const FindingSeveritySchema = z.enum([
  "error",
  "warning",
  "info",
  "hint",
]);

export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: FindingSeveritySchema,
  message: z.string(),
  suggestion: z.string(),
  category: FindingCategorySchema,
  confidence: z.number().min(0).max(1),
  range: RangeSchema.optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

export const FindingsArraySchema = z.array(FindingSchema);

export type FindingsArray = z.infer<typeof FindingsArraySchema>;
