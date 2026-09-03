"""
Database models for multiNicheAI 1.0
Postgres via SQLAlchemy
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    stripe_customer_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    credit_balance = relationship("CreditBalance", back_populates="user", uselist=False)
    usage_logs = relationship("UsageLog", back_populates="user")


class CreditBalance(Base):
    __tablename__ = "credit_balances"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(Float, default=0.0)  # supports fractional credits for partial-cost messages
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="credit_balance")


class CreditPurchase(Base):
    """Record of every credit pack purchase — needed for refund calculations."""
    __tablename__ = "credit_purchases"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_payment_intent_id = Column(String, unique=True, nullable=False)
    credits_purchased = Column(Float, nullable=False)
    amount_paid_cents = Column(Integer, nullable=False)
    credits_remaining_at_purchase = Column(Float, nullable=False)  # for prorated refunds
    purchased_at = Column(DateTime, default=datetime.utcnow)
    refunded = Column(Integer, default=0)  # 0 = no, 1 = yes


class UsageLog(Base):
    """Every chat exchange — for billing transparency and support lookups."""
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt_tokens = Column(Integer, nullable=False)
    completion_tokens = Column(Integer, nullable=False)
    credits_charged = Column(Float, nullable=False)
    model_used = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="usage_logs")
