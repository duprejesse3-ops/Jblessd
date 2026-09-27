# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Turns a spoken request into a plain-English (or plain-<language>) summary
plus exact shell commands, by calling Claude's Messages API directly (plain
HTTP, no SDK dependency -- same pattern as every other Claude-calling product
in this line of tools).

The model is told, explicitly, to prefer asking a clarifying question over
guessing when a request is ambiguous ("clean this up" could mean a dozen
different things) -- a wrong guess that gets voice-confirmed is exactly the
failure mode this whole tool exists to avoid.
"""
import json
import platform

import requests

from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL, is_windows
from .i18n import get as get_strings

API_URL = "https://api.anthropic.com/v1/messages"
TIMEOUT_SECONDS = 30

SYSTEM_PROMPT = """You are Hey Term, a cautious voice-controlled terminal assistant made by MultiNiche AI. \
The person speaks a request; you turn it into exact shell command(s) to run \
in their existing terminal session, or ask a clarifying question if the \
request is ambiguous or you're missing information you'd need to get it right.

Rules:
- Prefer the smallest, safest command that accomplishes exactly what was \
asked. Do not add steps the person didn't ask for (no extra cleanup, no \
"while I'm at it" changes).
- If the request could reasonably mean more than one thing, or names a file/\
target you have no way to confirm exists, ask a clarifying question instead \
of guessing.
- If the request is not something a shell command can do, say so in "clarify" \
rather than inventing a command that doesn't actually do it.
- Shell is {shell} on {os_name}. Use syntax that shell actually supports -- \
real bash (not a generic POSIX sh subset) on Linux/macOS, real PowerShell \
(not cmd.exe batch syntax) on Windows.
- Never chain an unrelated destructive command onto a benign request.
- Write "summary" (and "clarify", if you use it) in {language_name}, in a \
short, natural, speakable sentence -- it will be read aloud by text-to-speech, \
not displayed as text. Commands stay in real shell syntax regardless of \
{language_name}, since a shell doesn't speak {language_name}.

Respond with ONLY a single JSON object, no other text, in exactly one of \
these two shapes:

{{"summary": "<one plain sentence in {language_name} describing what will happen>", \
"commands": ["<command 1>", "<command 2>"]}}

or

{{"clarify": "<one short question in {language_name} to ask back>"}}
"""


class AgentError(Exception):
    pass


def _shell_name() -> str:
    return "PowerShell" if is_windows() else "bash"


def plan(request_text: str, language: str = "en", api_key: str = None) -> dict:
    """Ask Claude to turn spoken text into a plan. Returns either
    {"summary": str, "commands": [str, ...]} or {"clarify": str}.
    Raises AgentError on a network failure or a response that isn't valid
    JSON in one of those two shapes -- callers should treat that as "ask the
    person to repeat themselves," never as a command to run.
    """
    key = api_key or ANTHROPIC_API_KEY
    if not key:
        raise AgentError("ANTHROPIC_API_KEY is not set (see .env.example).")

    language_name = get_strings(language)["name"]
    system = SYSTEM_PROMPT.format(shell=_shell_name(), os_name=platform.system(), language_name=language_name)

    try:
        resp = requests.post(
            API_URL,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 500,
                "system": system,
                "messages": [{"role": "user", "content": request_text}],
            },
            timeout=TIMEOUT_SECONDS,
        )
    except requests.RequestException as err:
        raise AgentError(f"Could not reach Claude's API: {err}") from err

    if resp.status_code != 200:
        raise AgentError(f"Claude's API returned {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        text = "".join(
            block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
        ).strip()
    except (ValueError, KeyError) as err:
        raise AgentError(f"Unexpected response shape from Claude's API: {err}") from err

    return parse_plan(text)


def parse_plan(text: str) -> dict:
    """Pull the JSON object out of a model response and validate its shape.
    Separated from plan() so it's testable without a network call.
    """
    text = text.strip()
    # Models occasionally wrap JSON in a fenced code block despite being told
    # not to -- strip that rather than fail the whole turn over formatting.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as err:
        raise AgentError(f"Response wasn't valid JSON: {err}") from err

    if not isinstance(parsed, dict):
        raise AgentError("Response JSON wasn't an object.")

    if "clarify" in parsed:
        question = parsed.get("clarify")
        if not isinstance(question, str) or not question.strip():
            raise AgentError("'clarify' field was empty or not a string.")
        return {"clarify": question.strip()}

    if "summary" in parsed and "commands" in parsed:
        summary = parsed.get("summary")
        commands = parsed.get("commands")
        if not isinstance(summary, str) or not summary.strip():
            raise AgentError("'summary' field was empty or not a string.")
        if not isinstance(commands, list) or not commands:
            raise AgentError("'commands' field must be a non-empty list.")
        if not all(isinstance(c, str) and c.strip() for c in commands):
            raise AgentError("Every entry in 'commands' must be a non-empty string.")
        return {"summary": summary.strip(), "commands": [c.strip() for c in commands]}

    raise AgentError("Response JSON had neither a valid 'clarify' nor a valid 'summary'+'commands' shape.")
