import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8787),

  TAVILY_API_KEY: z.string().min(1),
  SEMANTIC_SCHOLAR_API_KEY: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Azure "OpenAI-compatible" chat completions endpoint configuration.
  // Example:
  // AZURE_OPENAI_ENDPOINT="https://YOUR-RESOURCE.openai.azure.com"
  // AZURE_OPENAI_DEPLOYMENT="claude-3-5-sonnet"
  // AZURE_OPENAI_API_VERSION="2024-02-15-preview"
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1),
  AZURE_OPENAI_API_VERSION: z.string().min(1).default("2024-02-15-preview"),
});

export const env = EnvSchema.parse(process.env);

