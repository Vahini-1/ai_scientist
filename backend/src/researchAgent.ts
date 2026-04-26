import { env } from "./env.js";
import { loadExpertMemory } from "./supabase.js";
import { tavily } from "@tavily/core";

export type SemanticScholarPaper = {
  title?: string;
  url?: string;
  year?: number;
  citationCount?: number;
  externalIds?: Record<string, string>;
};

const tvly = tavily({ apiKey: env.TAVILY_API_KEY });

export class ResearchAgent {
  static async getExpertMemory(experimentType: string) {
    return await loadExpertMemory(experimentType);
  }

  static async checkNovelty(query: string): Promise<SemanticScholarPaper[]> {
    const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set(
      "fields",
      [
        "title",
        "url",
        "year",
        "citationCount",
        "externalIds",
        "venue",
        "authors",
        "abstract",
      ].join(",")
    );

    const res = await fetch(url.toString(), {
      headers: {
        "content-type": "application/json",
        "x-api-key": env.SEMANTIC_SCHOLAR_API_KEY,
      },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Semantic Scholar request failed (${res.status}): ${errText}`);
    }
    const data = (await res.json()) as any;
    return (data?.data ?? []) as SemanticScholarPaper[];
  }

  static async getMarketData(query: string) {
    return await tvly.search(`${query} supplier catalog number and price 2026`, {
      searchDepth: "advanced",
      maxResults: 8,
      includeAnswer: true,
      includeRawContent: false,
    });
  }
}

