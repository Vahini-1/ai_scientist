import { tavily } from "@tavily/core";
import { env } from "./env.js";
const tvly = tavily({ apiKey: env.TAVILY_API_KEY });
export async function runSearches(hypothesis) {
    const queries = [
        `${hypothesis} novelty check peer reviewed`,
        `${hypothesis} detailed laboratory protocol 10 weeks`,
        `${hypothesis} chemical catalog numbers and pricing`,
    ];
    const [novelty, protocol, materials] = await Promise.all(queries.map((q) => tvly.search(q, {
        searchDepth: "advanced",
        maxResults: 8,
        includeAnswer: true,
        includeRawContent: false,
    })));
    return {
        novelty,
        protocol,
        materials,
    };
}
