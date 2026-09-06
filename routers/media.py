import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from services.n8n_client import dispatch_to_media_matrix
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/media", tags=["Media Ingestion"])

TABLE = "media_catalog"


class MediaIngestRequest(BaseModel):
    rawTitle: str
    url: str
    channel: str
    metadata: Optional[dict] = None


@router.post("/ingest")
async def ingest_media(item: MediaIngestRequest, background_tasks: BackgroundTasks):
    payload = {
        "rawTitle": item.rawTitle,
        "url": item.url,
        "channel": item.channel,
        "metadata": item.metadata or {},
    }

    supabase = get_supabase()
    if supabase:
        try:
            supabase.table(TABLE).insert(
                {
                    "raw_title": payload["rawTitle"],
                    "url": payload["url"],
                    "channel": payload["channel"],
                    "metadata": payload["metadata"],
                }
            ).execute()
        except Exception as err:
            logger.error("Failed to persist media catalog row: %s", err)
    else:
        logger.info("Supabase not configured; skipping catalog persistence for %s", payload["rawTitle"])

    background_tasks.add_task(dispatch_to_media_matrix, payload)

    return {
        "status": "QUEUED",
        "message": "Media payload accepted and dispatched to n8n Media Matrix Orchestrator.",
        "payload": payload,
    }


@router.get("/catalog")
async def get_catalog():
    supabase = get_supabase()
    if not supabase:
        return {"items": []}

    try:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("status", "active")
            .order("created_at", desc=True)
            .execute()
        )
        items = [
            {
                "id": row["id"],
                "rawTitle": row["raw_title"],
                "url": row["url"],
                "channel": row["channel"],
                "metadata": row.get("metadata") or {},
            }
            for row in res.data
        ]
        return {"items": items}
    except Exception as err:
        logger.error("Failed to read media catalog: %s", err)
        return {"items": []}
