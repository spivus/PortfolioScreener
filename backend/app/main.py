import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
from app.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.routes.auth import router as auth_router
from app.routes.upload import router as upload_router
from app.routes.portfolio import router as portfolio_router
from app.routes.musterportfolio import router as musterportfolio_router
from app.routes.chat import router as chat_router

app = FastAPI(
    title="Portfolio Analyzer API",
    version="0.1.0",
    description="Backend fuer die Portfolio Analyzer Web-App",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(portfolio_router)
app.include_router(musterportfolio_router)
app.include_router(chat_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
