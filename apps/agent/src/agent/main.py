"""The price-researcher agent.

Deployed once by ``mistral apps deploy`` as a managed agent (registered as ``agent-<app>``);
the price-research workflow opens a session on it per run instead of creating an agent.
Web search is done by our own tools (DuckDuckGo HTML scrape over httpx), not the platform's
billed ``web_search`` builtin.
"""

import re
from html import unescape
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx
from mistralai.agents import agents
from pydantic import BaseModel, Field

RESEARCH_MODEL = "mistral-large-4"

# The platform registers the app's agent module as agent-<app name in mistral.json> and the
# worker serves the workflow under the agent's own name, so the two must match. Kept a
# constant because the module is imported inside the workflow sandbox, which forbids file
# I/O at import time.
AGENT_NAME = "agent-mistral-purchasing-app"

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _strip_tags(html: str) -> str:
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


class WebSearchInput(BaseModel):
    query: str = Field(description="the search query, e.g. '<product> price <store> <city>'")


@agents.tool(
    name="web_search",
    description="Search the web for current product prices and offers.",
    input_schema=WebSearchInput,
)
async def web_search(args: WebSearchInput) -> str:
    query = args.query
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=_BROWSER_HEADERS) as client:
            response = await client.get(url)
        response.raise_for_status()
    except Exception as error:
        return f"web_search failed for query {query!r}: {error}"
    html = response.text
    results = re.findall(r'class="result__a"\s+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S)
    snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html, re.S)
    lines = []
    for index, (href, title_html) in enumerate(results[:8]):
        link = href
        if "uddg=" in link:
            link = parse_qs(urlparse(href).query).get("uddg", [href])[0]
        link = unquote(link)
        title = _strip_tags(title_html)
        snippet = _strip_tags(snippets[index]) if index < len(snippets) else ""
        lines.append(f"{index + 1}. {title}\n   {link}\n   {snippet}")
    if not lines:
        return f"No results found for query {query!r}."
    return "\n".join(lines)


class OpenPageInput(BaseModel):
    url: str = Field(description="the http(s) page to read, usually a result URL from web_search")


@agents.tool(
    name="open_page",
    description="Fetch a web page and return its visible text, truncated.",
    input_schema=OpenPageInput,
)
async def open_page(args: OpenPageInput) -> str:
    url = args.url
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=_BROWSER_HEADERS) as client:
            response = await client.get(url)
        response.raise_for_status()
    except Exception as error:
        return f"open_page failed for {url}: {error}"
    content_type = response.headers.get("content-type", "")
    if "html" not in content_type and "text" not in content_type and content_type:
        return f"{url} is not a text page (content-type {content_type!r}); no content extracted."
    return _strip_tags(response.text)[:8000]


_RESEARCHER_INSTRUCTIONS = (
    "You are a price researcher. Use the web_search tool to find current prices for the exact product the "
    "user asks about, in stores near the user's location (online stores that ship there, and physical "
    "stores within the given distance), and the open_page tool to read the most promising result pages. "
    "Always ground every price in a search result or page you actually opened; include the store name and "
    "the product page URL for each offer. Never invent prices. "
    "PRICE ACCURACY: report the effective price a buyer actually pays after all visible discounts, sale "
    "prices, coupons and promo codes. If a page shows a struck-through original price next to a lower "
    "sale price, the sale price is the price and the struck-through one is the original. Prefer the price "
    "on the product page over a search snippet. If the real price is not clearly visible (login required, "
    "'contact us', dynamic pricing), set the price to null and explain in the note. "
    "SEARCH BUDGET: every web_search call scrapes a live search engine and can be rate-limited, so be "
    "frugal. Run at most 8 web_search calls in total, issue related queries in parallel within a single "
    "turn instead of one per turn, and stop searching as soon as you have prices from at least 5 stores "
    "or new searches stop surfacing new stores. Prefer open_page on the most promising results over "
    "extra searches. "
    "When you are done, summarize every offer you found, cheapest first, one per line: "
    "'STORE | price CURRENCY | original CURRENCY | in stock: yes/no | distance: X km | URL | note'."
)

agent = agents.Agent(
    model=RESEARCH_MODEL,
    name=AGENT_NAME,
    description="Finds current prices for a product in stores near the user's location.",
    instructions=_RESEARCHER_INSTRUCTIONS,
    tools=[web_search, open_page],
    max_iterations=8,
)
