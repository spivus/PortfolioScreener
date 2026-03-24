from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class PortfolioPositionBase(BaseModel):
    isin: Optional[str] = None
    name: str
    quantity: float
    purchase_price: float
    currency: str = "EUR"


class PortfolioPositionCreate(PortfolioPositionBase):
    pass


class PortfolioPositionOut(PortfolioPositionBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UploadResponse(BaseModel):
    message: str
    positions_count: int
    positions: List[PortfolioPositionOut]
