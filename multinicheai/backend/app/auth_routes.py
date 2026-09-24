"""
Auth endpoints for multiNicheAI 1.0 — signup, login.
New users start with a free credit balance (fair-practice: lets people try
the assistant before paying, per the pricing plan's suggestion).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from .database import get_db
from .models import User, CreditBalance
from .auth_utils import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

SIGNUP_FREE_CREDITS = 10.0


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    credit_balance: float


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = User(email=req.email, hashed_password=hash_password(req.password))
    db.add(user)
    db.flush()

    balance = CreditBalance(user_id=user.id, balance=SIGNUP_FREE_CREDITS)
    db.add(balance)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user_id=user.id, credit_balance=SIGNUP_FREE_CREDITS)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(user.id)
    balance = user.credit_balance.balance if user.credit_balance else 0.0
    return TokenResponse(access_token=token, user_id=user.id, credit_balance=balance)
