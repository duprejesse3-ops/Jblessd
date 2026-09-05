"""
Catalog retrieval for multiNicheAI 1.0.

Pulls real product data from multinicheai.com's existing /api/products endpoint
(the same Postgres-backed catalog the storefront uses) and does simple
keyword/category/niche matching to find the products most relevant to
a customer's message. The matches get injected into the system prompt
so the assistant answers with real SKUs, prices, and specs instead of
making things up.

This is a lightweight keyword-match retriever, not a vector database —
fine for a catalog of this size. If the catalog grows into the thousands
of products, swap the matching step for embeddings + a vector store
(e.g. pgvector, since you're already on Postgres) without touching
anything else in this file's public interface (get_relevant_products).
"""
import os
import time
import httpx

CATALOG_API_URL = os.environ.get("CATALOG_API_URL", "https://multinicheai.com/api/products")
CACHE_TTL_SECONDS = 300  # re-fetch the catalog at most every 5 minutes

_cache = {"products": [], "fetched_at": 0}

NICHE_KEYS = [
    "founders", "sales", "marketers", "developers", "writers",
    "students", "office", "finance", "architects", "engineers", "stores",
]
CATEGORY_KEYS = {
    "prompts": "Prompt Packs",
    "automations": "Automation Blueprints",
    "templates": "Doc Templates",
    "agents": "Agent Configs",
}


def _fetch_catalog() -> list[dict]:
    now = time.time()
    if _cache["products"] and (now - _cache["fetched_at"]) < CACHE_TTL_SECONDS:
        return _cache["products"]

    try:
        response = httpx.get(CATALOG_API_URL, timeout=5.0)
        response.raise_for_status()
        products = response.json()
    except (httpx.HTTPError, ValueError):
        # Fail soft: if the catalog API is down, keep the last good cache
        # (even if stale) rather than breaking chat entirely.
        return _cache["products"]

    _cache["products"] = products
    _cache["fetched_at"] = now
    return products


def _score_product(product: dict, query_lower: str, mentioned_niches: set, mentioned_categories: set) -> int:
    score = 0
    name = (product.get("name") or "").lower()
    blurb = (product.get("blurb") or "").lower()
    niche = product.get("niche")
    category = product.get("category")

    for word in query_lower.split():
        if len(word) < 3:
            continue
        if word in name:
            score += 3
        if word in blurb:
            score += 1

    if niche in mentioned_niches:
        score += 4
    if category in mentioned_categories:
        score += 4

    return score


def get_relevant_products(query: str, max_results: int = 5) -> list[dict]:
    """
    Returns the products most relevant to the customer's message, ranked
    by simple keyword/niche/category overlap. Used to build grounded
    context for the chat system prompt.
    """
    products = _fetch_catalog()
    if not products:
        return []

    query_lower = query.lower()
    mentioned_niches = {n for n in NICHE_KEYS if n in query_lower}
    mentioned_categories = {k for k, label in CATEGORY_KEYS.items() if label.lower() in query_lower or k in query_lower}

    scored = [
        (p, _score_product(p, query_lower, mentioned_niches, mentioned_categories))
        for p in products
    ]
    scored = [(p, s) for p, s in scored if s > 0]
    scored.sort(key=lambda x: x[1], reverse=True)

    return [p for p, _ in scored[:max_results]]


def format_products_for_context(products: list[dict]) -> str:
    """Turns matched products into a compact block for the system prompt."""
    if not products:
        return ""

    lines = ["Relevant products from the live catalog (use these exact details when answering):"]
    for p in products:
        lines.append(
            f"- {p.get('sku', '?')}: {p.get('name', '?')} "
            f"({p.get('catlabel', p.get('category', '?'))}, {p.get('nichelabel', p.get('niche', '?'))}) "
            f"— ${p.get('price', '?')} — {p.get('blurb', '')}"
        )
    return "\n".join(lines)
