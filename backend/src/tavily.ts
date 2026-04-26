import { tavily } from "@tavily/core";
import { env } from "./env.js";

export type TavilyResult = {
  query: string;
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
    published_date?: string;
  }>;
};
//const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const tvly = tavily({ apiKey: env.TAVILY_API_KEY });

export async function runSearches(hypothesis: string) {
  const queries = [
    `${hypothesis} novelty check peer reviewed`,
    `${hypothesis} detailed laboratory protocol 10 weeks`,
    `${hypothesis} chemical catalog numbers and pricing`,
  ];

  const [novelty, protocol, materials] = await Promise.all(
    queries.map((q) =>
      tvly.search(q, {
        searchDepth: "advanced",
        maxResults: 8,
        includeAnswer: true,
        includeRawContent: false,
      }) as Promise<TavilyResult>
    )
  );

  return {
    novelty,
    protocol,
    materials,
  };
}

