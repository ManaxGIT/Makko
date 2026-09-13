from fastapi import APIRouter

from app.api.v1.endpoints import explore, home, orders

router = APIRouter(prefix="/api/v1")
router.include_router(explore.router)
router.include_router(home.router)
router.include_router(orders.router)


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
