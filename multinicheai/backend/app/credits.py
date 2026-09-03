"""
Credit system logic for multiNicheAI 1.0

Fair-practice notes baked into this module:
- Cost is estimated and shown to the user BEFORE the request is sent (see estimate_cost)
- Credits never expire — no cleanup job that zeroes out balances
- All deductions are logged to UsageLog for a fully transparent history
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .models import User, CreditBalance, UsageLog

# 1 credit ≈ 1 typical exchange (~650 tokens combined). Tune this against real usage.
TOKENS_PER_CREDIT = 650


def estimate_cost(prompt_tokens_estimate: int, expected_completion_tokens: int = 300) -> float:
    """
    Estimate credit cost BEFORE sending to the model, so the UI can show
    the customer a cost preview and let them cancel if they want.
    """
    total_estimate = prompt_tokens_estimate + expected_completion_tokens
    credits = round(total_estimate / TOKENS_PER_CREDIT, 2)
    return max(credits, 0.1)  # floor so trivial messages still register a minimal charge


def get_balance(db: Session, user_id: int) -> float:
    bal = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
    if not bal:
        raise HTTPException(status_code=404, detail="No credit balance found for user")
    return bal.balance


def has_sufficient_credits(db: Session, user_id: int, estimated_cost: float) -> bool:
    return get_balance(db, user_id) >= estimated_cost


def charge_credits(
    db: Session,
    user_id: int,
    prompt_tokens: int,
    completion_tokens: int,
    model_used: str,
) -> float:
    """
    Deduct actual cost AFTER the model call completes (actual token counts,
    not the pre-send estimate). Logs the exchange for full transparency.
    Raises if the user somehow has insufficient balance (shouldn't happen if
    estimate_cost + has_sufficient_credits was checked first, but guards
    against race conditions).
    """
    actual_credits = round((prompt_tokens + completion_tokens) / TOKENS_PER_CREDIT, 2)
    actual_credits = max(actual_credits, 0.1)

    bal = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
    if not bal or bal.balance < actual_credits:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    bal.balance -= actual_credits

    log = UsageLog(
        user_id=user_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        credits_charged=actual_credits,
        model_used=model_used,
    )
    db.add(log)
    db.commit()
    return bal.balance


def add_credits(db: Session, user_id: int, amount: float) -> float:
    """Used by the Stripe webhook after a successful purchase."""
    bal = db.query(CreditBalance).filter(CreditBalance.user_id == user_id).first()
    if not bal:
        bal = CreditBalance(user_id=user_id, balance=0.0)
        db.add(bal)
        db.flush()
    bal.balance += amount
    db.commit()
    return bal.balance
