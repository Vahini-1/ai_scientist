import { z } from "zod";

export const GeneratePlanRequestSchema = z.object({
  hypothesis: z.string().min(5),
  constraints: z.string().optional(),
  experimentType: z.string().min(1).default("general"),
  isReviewing: z.boolean().default(false),
  editedText: z.string().optional(),
  correction: z
    .object({
      domain: z.string().optional(),
      source: z.string().optional(),
      field: z.string().optional(),
      before: z.string().optional(),
      after: z.string().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;

export const NoveltyCheckRequestSchema = z.object({
  hypothesis: z.string().min(5),
});

export const NoveltyCheckResponseSchema = z.object({
  noveltyStatus: z.enum(["not found", "similar work exists", "exact match found"]),
  priorPapers: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      doi: z.string().optional(),
      year: z.number().int().optional(),
      citationCount: z.number().int().optional(),
      score: z.number().optional(),
    })
  ),
});

export type NoveltyCheckResponse = z.infer<typeof NoveltyCheckResponseSchema>;

export const PlanSchema = z.object({
  summary: z.object({
    noveltyStatus: z.enum(["not found", "similar work exists", "exact match found"]),
    noveltyReason: z.string(),
    priorPapers: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        doi: z.string().optional(),
        year: z.number().int().optional(),
      })
    ),
    totalBudget: z.number(),
  }),
  protocol: z.array(
    z.object({
      step: z.number().int().positive(),
      instruction: z.string(),
      duration: z.string(),
      citations: z.array(z.string()),
    })
  ),
  materials: z.array(
    z.object({
      item: z.string(),
      catalogNum: z.string(),
      vendor: z.string(),
      price: z.number(),
    })
  ),
  budget: z.array(
    z.object({
      category: z.string(),
      description: z.string(),
      amount: z.number(),
    })
  ),
  timeline: z.object({
    weeks: z.array(
      z.object({
        week: z.number().int().positive(),
        tasks: z.array(z.string()),
      })
    ),
  }),
  literature: z.array(
    z.object({
      title: z.string(),
      doi: z.string(),
      relevance: z.string(),
    })
  ),
  memory: z.array(z.record(z.unknown())),
});

export type Plan = z.infer<typeof PlanSchema>;

