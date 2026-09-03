"""
Stripe integration for multiNicheAI 1.0 credit packs.

Fair-practice notes:
- Packs are one-time purchases only (no hidden subscription trap)
- Pricing table below is the single source of truth — must match what's
  displayed on the storefront so there's never a mismatch between
  advertised price and charged price
"""
import os
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .credits import add_credits
from .models import User, CreditPurchase
from .auth_utils import get_current_user_id

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]

router = APIRouter(prefix="/billing", tags=["billing"])

# Single source of truth for pack pricing — keep in sync with storefront display
CREDIT_PACKS = {
    "starter": {"credits": 100, "price_cents": 500},
    "standard": {"credits": 500, "price_cents": 2000},
    "pro": {"credits": 1500, "price_cents": 5000},
    "power": {"credits": 5000, "price_cents": 15000},
}


@router.post("/checkout/{pack_id}")
def create_checkout_session(
    pack_id: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if pack_id not in CREDIT_PACKS:
        raise HTTPException(status_code=400, detail="Unknown credit pack")

    pack = CREDIT_PACKS[pack_id]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": f"multiNicheAI credits — {pack_id} pack ({pack['credits']} credits)"},
                "unit_amount": pack["price_cents"],
            },
            "quantity": 1,
        }],
        mode="payment",  # one-time purchase, not subscription
        success_url=os.environ.get("CHECKOUT_SUCCESS_URL", "https://jblessd.com/checkout/success"),
        cancel_url=os.environ.get("CHECKOUT_CANCEL_URL", "https://jblessd.com/checkout/cancel"),
        client_reference_id=str(user_id),
        metadata={"pack_id": pack_id, "credits": pack["credits"]},
    )
    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = int(session["client_reference_id"])
        credits = int(session["metadata"]["credits"])
        amount_paid = session["amount_total"]

        new_balance = add_credits(db, user_id, credits)

        purchase = CreditPurchase(
            user_id=user_id,
            stripe_payment_intent_id=session["payment_intent"],
            credits_purchased=credits,
            amount_paid_cents=amount_paid,
            credits_remaining_at_purchase=new_balance,
        )
        db.add(purchase)
        db.commit()

    return {"status": "ok"}
