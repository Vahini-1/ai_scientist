import os
import requests
from tavily import TavilyClient
from supabase import create_client, Client

# Initialize Clients
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

class ResearchAgent:
    
    @staticmethod
    def get_expert_memory(experiment_type: str):
        """Fetch past corrections for this specific type of experiment."""
        response = supabase.table("expert_memory") \
            .select("*") \
            .eq("experiment_type", experiment_type) \
            .limit(5) \
            .execute()
        return response.data

    @staticmethod
    def check_novelty(query: str):
        """Use Semantic Scholar to find existing papers for the novelty signal."""
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query}&limit=5&fields=title,url,citationCount,year"
        headers = {"x-api-key": os.getenv("SEMANTIC_SCHOLAR_KEY")}
        response = requests.get(url, headers=headers)
        return response.json().get("data", [])

    @staticmethod
    def get_market_data(query: str):
        """Use Tavily to find real-world pricing and catalog numbers."""
        # 'research' model is better for technical deep dives
        return tavily.search(query=f"{query} supplier catalog number and price 2026", 
                             search_depth="advanced")

    @staticmethod
    def save_expert_edit(data: dict):
        """Save a new correction from the scientist back to Supabase."""
        return supabase.table("expert_memory").insert(data).execute()