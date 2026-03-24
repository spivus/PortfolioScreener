from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.database import Base


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    isin = Column(String(12), nullable=True)
    name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    purchase_price = Column(Float, nullable=False)
    currency = Column(String(3), default="EUR")
    created_at = Column(DateTime, default=datetime.utcnow)
