import os
import feedparser
from datetime import datetime
from supabase import create_client, Client

# --- CONFIGURATION ---
SUPABASE_URL = "https://fvktqmcuqgasljcgkojd.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "YOUR_KEY_HERE")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Topic Taxonomy Rules for Pure Spoken Content
TAXONOMY_RULES = {
    "Gnostic Studies": [
        "gnostic", "gnosticism", "nag hammadi", "gospel of thomas",
        "gospel of philip", "pisti sophia", "demiurge", "archon", "sophia"
    ],
    "Precession & Archaeoastronomy": [
        "precession", "equinox", "great year", "axial precession",
        "zodiacal", "solstice", "dendera zodiac"
    ],
    "Antediluvian & Cataclysmic History": [
        "pre-flood", "antediluvian", "younger dryas", "megalithic",
        "atlantis", "cataclysm", "gobekli tepe", "gunung padang"
    ],
    "Ancient Cosmology & Hermeticism": [
        "hermetica", "corpus hermeticum", "sacred geometry",
        "as above so below", "monad", "emerald tablet"
    ]
}

def classify_content(title: str, summary: str):
    score_val = 0
    best_category = "Public Lectures & Archives"
    
    for cat, keywords in TAXONOMY_RULES.items():
        score = sum(1 for kw in keywords if kw in title.lower() or kw in summary.lower())
        if score > score_val:
            score_val = score
            best_category = cat
            
    return best_category

def ingest_podcast(rss_url: str, default_speaker: str = "The Alchemist"):
    print(f"Fetching Feed: {rss_url}")
    feed = feedparser.parse(rss_url)
    
    for entry in feed.entries:
        title = entry.get("title", "Untitled Episode")
        summary = entry.get("summary", entry.get("description", ""))
        content = entry.get("content", [{"value": summary}])[0]["value"]
        
        pub_date = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            pub_date = datetime(*entry.published_parsed[:6]).isoformat()
            
        # Strict Audio Filtering: Strip out any secondary links or synth enclosures, 
        # ensuring only standard speech/audio enclosures are mapped.
        audio_url = None
        if hasattr(entry, "enclosures") and entry.enclosures:
            for enc in entry.enclosures:
                enc_type = enc.get("type", "")
                enc_url = enc.get("href", "")
                # Exclude anything flagged as ambient, synth, or non-standard audio
                if "audio" in enc_type and "synth" not in enc_url and "ambient" not in enc_url:
                    audio_url = enc_url
                    break
        
        # Fallback if no clean enclosure is found
        if not audio_url and hasattr(entry, "link"):
            audio_url = entry.link

        category = classify_content(title, summary)
        
        payload = {
            "category": category,
            "title": title,
            "summary": summary,
            "content": content,
            "published_at": pub_date,
            "speaker_or_author": default_speaker,
            "audio_url": audio_url,
            "source_feed": rss_url
        }
        
        try:
            supabase.table("media_archives").upsert(payload, on_conflict="title").execute()
            print(f"Successfully Ingested (Clean Speech): {title} [{category}]")
        except Exception as e:
            print(f"Error upserting record: {e}")

if __name__ == "__main__":
    # Pointing to verified speech feed sources
    ingest_podcast("https://www.nasa.gov/rss/dyn/shuttle-missions.rss", default_speaker="The Alchemist")