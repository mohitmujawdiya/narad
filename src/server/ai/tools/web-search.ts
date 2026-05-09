import { tool, jsonSchema } from "ai";

export const webSearchTool = tool({
  description:
    "Search the web for current information about markets, competitors, products, trends, statistics, or any topic relevant to product management. Use this when you need real-time data to ground your advice.",
  inputSchema: jsonSchema<{ query: string }>({
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey || apiKey.startsWith("tvly-your")) {
      return {
        results: [],
        note: "Web search is not configured. Set TAVILY_API_KEY in your .env file.",
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: 5,
          include_answer: true,
          search_depth: "advanced",
        }),
      });

      if (!response.ok) {
        return { results: [], note: `Search failed: ${response.statusText}` };
      }

      const data = await response.json();

      return {
        answer: data.answer,
        results: data.results?.map(
          (r: { title: string; url: string; content: string }) => ({
            title: r.title,
            url: r.url,
            snippet: r.content?.slice(0, 300),
          })
        ),
      };
    } catch (error) {
      return {
        results: [],
        note: `Search error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
