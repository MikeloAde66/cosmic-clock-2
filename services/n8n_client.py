import logging
import os
from typing import Any, Dict, Optional

import httpx

N8N_MEDIA_WEBHOOK_URL = os.getenv("N8N_MEDIA_WEBHOOK_URL")
logger = logging.getLogger(__name__)


async def dispatch_to_media_matrix(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Dispatches ingested media metadata to the n8n Media Matrix Orchestrator.
    No-op if N8N_MEDIA_WEBHOOK_URL is unset (no n8n instance wired up yet) —
    mirrors the N8N_LEAD_WEBHOOK_URL pattern in app/api/leads/route.ts.
    """
    if not N8N_MEDIA_WEBHOOK_URL:
        logger.info("N8N_MEDIA_WEBHOOK_URL not set; skipping dispatch for %s", payload.get("rawTitle"))
        return None

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(N8N_MEDIA_WEBHOOK_URL, json=payload)
            response.raise_for_status()
            logger.info("Successfully dispatched media payload: %s", payload.get("rawTitle"))
            return response.json()
        except httpx.HTTPError as err:
            logger.error("Failed to reach n8n webhook: %s", err)
            return None
