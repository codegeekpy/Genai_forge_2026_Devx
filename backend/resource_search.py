"""Resource search: YouTube videos via Invidious and web articles via DuckDuckGo."""

import httpx
import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

# Public Invidious instances for YouTube search
INVIDIOUS_INSTANCES = [
    "https://vid.puffyan.us",
    "https://invidious.fdn.fr",
    "https://invidious.privacyredirect.com",
    "https://inv.nadeko.net",
]


async def search_youtube(query: str, max_results: int = 3) -> list[dict]:
    """Search YouTube videos via Invidious public API."""
    resources = []

    for instance in INVIDIOUS_INSTANCES:
        try:
            url = f"{instance}/api/v1/search"
            params = {
                "q": query,
                "type": "video",
                "sort_by": "relevance",
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

            for item in data[:max_results]:
                video_id = item.get("videoId", "")
                resources.append({
                    "title": item.get("title", "Untitled"),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "source": "youtube",
                    "thumbnail": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                    "description": (item.get("description", "") or "")[:200],
                })

            if resources:
                logger.info(f"Found {len(resources)} YouTube videos for '{query}' via {instance}")
                return resources

        except Exception as e:
            logger.warning(f"Invidious instance {instance} failed: {e}")
            continue

    # Fallback: return YouTube search link
    resources.append({
        "title": f"Search YouTube: {query}",
        "url": f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}",
        "source": "youtube",
        "thumbnail": None,
        "description": f"Search YouTube for: {query}",
    })
    return resources


async def search_web(query: str, max_results: int = 3) -> list[dict]:
    """Search web articles via DuckDuckGo."""
    resources = []

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(f"{query} tutorial guide", max_results=max_results))

        for item in results:
            resources.append({
                "title": item.get("title", "Untitled"),
                "url": item.get("href", ""),
                "source": "web",
                "thumbnail": None,
                "description": (item.get("body", "") or "")[:200],
            })

        logger.info(f"Found {len(resources)} web resources for '{query}'")

    except Exception as e:
        logger.warning(f"DuckDuckGo search failed for '{query}': {e}")
        resources.append({
            "title": f"Search: {query}",
            "url": f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
            "source": "web",
            "thumbnail": None,
            "description": f"Search the web for: {query}",
        })

    return resources
