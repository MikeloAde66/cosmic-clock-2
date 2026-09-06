import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/radio", tags=["Radio State"])

TABLE = "radio_state"


class RadioToggleRequest(BaseModel):
    key: Literal["daily_queue", "program_manager"]
    enabled: bool


@router.get("/state")
async def get_radio_state():
    supabase = get_supabase()
    if not supabase:
        return {"daily_queue": False, "program_manager": False}

    try:
        res = supabase.table(TABLE).select("key, enabled").execute()
        state = {row["key"]: row["enabled"] for row in res.data}
        return {
            "daily_queue": state.get("daily_queue", False),
            "program_manager": state.get("program_manager", False),
        }
    except Exception as err:
        logger.error("Failed to read radio state: %s", err)
        return {"daily_queue": False, "program_manager": False}


@router.post("/toggle")
async def toggle_radio_state(item: RadioToggleRequest):
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        supabase.table(TABLE).upsert({"key": item.key, "enabled": item.enabled}).execute()
    except Exception as err:
        logger.error("Failed to update radio state: %s", err)
        raise HTTPException(status_code=502, detail="Failed to persist radio state")

    return {"status": "ok", "key": item.key, "enabled": item.enabled}
