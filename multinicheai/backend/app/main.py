from fastapi import FastAPI
from .database import engine
from .models import Base
from . import chat, stripe_routes, auth_routes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="multiNicheAI 1.0 API")

app.include_router(auth_routes.router)
app.include_router(chat.router)
app.include_router(stripe_routes.router)


@app.get("/health")
def health():
    return {"status": "ok"}
