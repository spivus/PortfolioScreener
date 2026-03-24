from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.csv_parser import parse_csv
from app.database import get_db
from app.models import PortfolioPosition
from app.schemas import PortfolioPositionOut, UploadResponse

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/upload", response_model=UploadResponse)
async def upload_portfolio(file: UploadFile, db: AsyncSession = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    content = await file.read()

    try:
        parsed = parse_csv(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    positions: list[PortfolioPosition] = []
    for row in parsed:
        pos = PortfolioPosition(**row)
        db.add(pos)
        positions.append(pos)

    await db.commit()

    # Refresh to populate id / created_at from the DB
    for pos in positions:
        await db.refresh(pos)

    return UploadResponse(
        message=f"Successfully imported {len(positions)} positions.",
        positions_count=len(positions),
        positions=[PortfolioPositionOut.model_validate(p) for p in positions],
    )


@router.get("", response_model=List[PortfolioPositionOut])
async def get_portfolio(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PortfolioPosition).order_by(PortfolioPosition.id))
    return result.scalars().all()


@router.delete("")
async def delete_portfolio(db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(PortfolioPosition))
    await db.commit()
    return {"message": f"Deleted {result.rowcount} positions."}
