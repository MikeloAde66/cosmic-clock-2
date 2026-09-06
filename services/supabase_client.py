import logging
import os
from typing import Optional

from supabase import Client, create_client

logger = logging.getLogger(__name__)

# Same project ingest.py already writes to (its media_archives table) —
# only the key is a secret, so only it comes from the environment.
SUPABASE_URL = "https://fvktqmcuqgasljcgkojd.supabase.co"

_client: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """Returns a cached service-role client, or None if SUPABASE_KEY is unset."""
    global _client
    if _client is not None:
        return _client
    key = os.getenv("SUPABASE_KEY")
    if not key:
        logger.warning("SUPABASE_KEY not set; Supabase-backed features are disabled.")
        return None
    _client = create_client(SUPABASE_URL, key)
    return _client
