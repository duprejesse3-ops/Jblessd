"""
Chat endpoint for multiNicheAI 1.0.

Flow:
1. Estimate cost, check balance, reject early with a clear message if insufficient
2. Call the model API
3. Charge actual credits based on real token usage
4. Return response + updated balance so the app can display it immediately
"""
import os
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .database import get_db
from .credits import estimate_cost, has_sufficient_credits, charge_credits
from .auth_utils import get_current_user_id
from .catalog import get_relevant_products, format_products_for_context

router = APIRouter(prefix="/chat", tags=["chat"])
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

MODEL = "claude-sonnet-4-6"  # swap per pricing tier if you offer a cheaper/faster model option

BASE_SYSTEM_PROMPT = """You are multiNicheAI, the assistant for jblessd.com (MultiNiche AI).
Help customers with product questions, store info, and general chat brainstorming.
Be concise, friendly, and accurate.

When product context is provided below, use those exact SKUs, prices, and
details in your answer — never invent a SKU, price, or spec. If no relevant
product context is given and the customer asks about a specific product,
say you're not certain and suggest they check the catalog page, rather
than guessing."""


def build_system_prompt(user_message: str) -> str:
    """Grounds the assistant in the real catalog for this specific message."""
    matches = get_relevant_products(user_message)
    context_block = format_products_for_context(matches)
    if context_block:
        return f"{BASE_SYSTEM_PROMPT}\n\n{context_block}"
    return BASE_SYSTEM_PROMPT


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []  # [{"role": "user"/"assistant", "content": "..."}]


class CostPreviewRequest(BaseModel):
    message: str


@router.post("/estimate")
def preview_cost(
    req: CostPreviewRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Called by the client before sending, to show the user the cost up front."""
    rough_prompt_tokens = len(req.message) // 4  # crude estimate; refine with a real tokenizer
    est = estimate_cost(rough_prompt_tokens)
    affordable = has_sufficient_credits(db, user_id, est)
    return {"estimated_credits": est, "affordable": affordable}


@router.post("/send")
def send_message(
    req: ChatRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    rough_prompt_tokens = len(req.message) // 4
    est = estimate_cost(rough_prompt_tokens)

    if not has_sufficient_credits(db, user_id, est):
        raise HTTPException(
            status_code=402,
            detail="Not enough credits for this message. Top up to continue.",
        )

    messages = req.conversation_history + [{"role": "user", "content": req.message}]
    system_prompt = build_system_prompt(req.message)

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    reply_text = "".join(block.text for block in response.content if block.type == "text")

    new_balance = charge_credits(
        db,
        user_id=user_id,
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
        model_used=MODEL,
    )

    return {
        "reply": reply_text,
        "credits_charged": round(
            (response.usage.input_tokens + response.usage.output_tokens) / 650, 2
        ),
        "remaining_balance": new_balance,
    }
