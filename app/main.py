from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401  (ensures all models are registered on Base)
from app.routers import auth, vendors, events, quotations, tasks, sops, workflow

Base.metadata.create_all(bind=engine)

app = FastAPI(title="EventOS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(events.router)
app.include_router(quotations.router)
app.include_router(tasks.router)
app.include_router(sops.router)
app.include_router(workflow.router)


@app.get("/health")
def health():
    return {"status": "ok"}
