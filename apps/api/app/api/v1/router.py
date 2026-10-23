from fastapi import APIRouter

from app.api.v1.endpoints import addresses, explore, home, locations, meals, orders

router = APIRouter(prefix="/api/v1")
router.include_router(explore.router)
router.include_router(home.router)
router.include_router(orders.router)
router.include_router(addresses.router)
router.include_router(locations.router)
router.include_router(meals.router)


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
