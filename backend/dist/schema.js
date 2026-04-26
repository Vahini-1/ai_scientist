import { z } from "zod";
export const GeneratePlanRequestSchema = z.object({
    hypothesis: z.string().min(5),
    experimentType: z.string().min(1).default("general"),
    isReviewing: z.boolean().default(false),
    editedText: z.string().optional(),
});
export const PlanSchema = z.object({
    summary: z.object({
        noveltySignal: z.number(),
        noveltyReason: z.string(),
        totalBudget: z.number(),
    }),
    protocol: z.array(z.object({
        step: z.number().int().positive(),
        instruction: z.string(),
        duration: z.string(),
        citations: z.array(z.string()),
    })),
    materials: z.array(z.object({
        item: z.string(),
        catalogNum: z.string(),
        vendor: z.string(),
        price: z.number(),
    })),
    budget: z.array(z.object({
        category: z.string(),
        description: z.string(),
        amount: z.number(),
    })),
    timeline: z.object({
        weeks: z.array(z.object({
            week: z.number().int().positive(),
            tasks: z.array(z.string()),
        })),
    }),
    literature: z.array(z.object({
        title: z.string(),
        doi: z.string(),
        relevance: z.string(),
    })),
    memory: z.array(z.record(z.unknown())),
});
