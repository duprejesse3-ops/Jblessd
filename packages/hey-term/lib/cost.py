# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Running total of what this project's Hey Term sessions have spent calling
Claude's API, in dollars.

Hey Term is bring-your-own-API-key: the person's key, their bill, no
markup, no metering on MultiNiche AI's end. That also means the only way
someone finds out what a voice-controlled terminal has been costing them is
the Anthropic console -- easy to forget to check. This keeps a local,
approximate running total instead, computed from the token counts the API
itself returns with every response (see lib/agent.py's plan()), persisted to
config.COST_LOG_PATH so it survives restarts and reflects one project's
usage, not every project Hey Term has ever touched.

Prices are approximate and only cover models this product is actually
configured to call -- see PRICING below. A model not listed falls back to
the default entry rather than raising, since "the estimate might be slightly
off" is a far better failure mode for a cost *estimate* than "Hey Term
crashed because a model string didn't match."
"""
import json
import os
import threading

from . import config

_LOCK = threading.Lock()

# Dollars per million tokens (input, output). Anthropic's published pricing
# as of when this was written -- check the current rates if this number
# looks stale, this is a local estimate, not a bill.
PRICING = {
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-opus-4-5": (5.00, 25.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "_default": (3.00, 15.00),
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = PRICING.get(model, PRICING["_default"])
    return (input_tokens / 1_000_000) * in_rate + (output_tokens / 1_000_000) * out_rate


def _load(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and "total_cost_usd" in data:
                return data
    except (OSError, json.JSONDecodeError):
        pass
    return {"total_cost_usd": 0.0, "total_input_tokens": 0, "total_output_tokens": 0, "requests": 0}


def record_usage(model: str, input_tokens: int, output_tokens: int, path: str = None) -> dict:
    """Adds one API call's usage to the running total and persists it.
    Returns the updated totals. Thread-safe (the background-jobs feature and
    the main loop could in principle both touch this) and best-effort -- a
    write failure here must never take down the request it's tracking.
    """
    target = path or config.COST_LOG_PATH
    cost = estimate_cost(model, input_tokens, output_tokens)
    with _LOCK:
        totals = _load(target)
        totals["total_cost_usd"] = round(totals["total_cost_usd"] + cost, 6)
        totals["total_input_tokens"] += input_tokens
        totals["total_output_tokens"] += output_tokens
        totals["requests"] += 1
        try:
            os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                json.dump(totals, f)
        except OSError:
            pass
    return totals


def get_totals(path: str = None) -> dict:
    return _load(path or config.COST_LOG_PATH)


def spoken_summary(path: str = None) -> str:
    totals = get_totals(path)
    cost = totals["total_cost_usd"]
    requests = totals["requests"]
    if requests == 0:
        return "This project hasn't made any Claude requests yet."
    noun = "request" if requests == 1 else "requests"
    return f"This project has used about ${cost:.2f} across {requests} {noun}."
