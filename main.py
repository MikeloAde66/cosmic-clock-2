from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests

app = FastAPI(
    title="Internet Archive Media & Podcast Ingestion Service",
    description="Queries Archive.org for audio, podcasts, and historical media items.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IA_SEARCH_URL = "https://archive.org/advancedsearch.php"
IA_METADATA_URL = "https://archive.org/metadata/"
IA_DOWNLOAD_BASE = "https://archive.org/download/"


class PodcastFile(BaseModel):
    file_name: str
    format: str
    download_url: str
    size_bytes: Optional[int] = None


class PodcastItem(BaseModel):
    identifier: str
    title: str
    creator: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    details_url: str
    audio_files: List[PodcastFile] = []
    transcript_url: Optional[str] = None


@app.get("/search/podcasts", response_model=List[PodcastItem])
def search_archive_podcasts(
    query: str = Query(..., description="Search term (e.g., 'ufo podcast', 'ancient history', 'gnostic')"),
    rows: int = Query(10, ge=1, le=50, description="Number of results to return")
):
    search_params = {
        "q": f'({query}) AND mediatype:(audio)',
        "fl[]": "identifier,title,creator,date,description",
        "sort[]": "date desc",
        "rows": rows,
        "page": 1,
        "output": "json"
    }

    try:
        response = requests.get(IA_SEARCH_URL, params=search_params, timeout=10)
        response.raise_for_status()
        search_data = response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch from Internet Archive: {str(e)}")

    docs = search_data.get("response", {}).get("docs", [])
    results: List[PodcastItem] = []

    for doc in docs:
        identifier = doc.get("identifier")
        if not identifier:
            continue

        item = PodcastItem(
            identifier=identifier,
            title=doc.get("title", "Untitled"),
            creator=doc.get("creator"),
            date=doc.get("date"),
            description=doc.get("description"),
            details_url=f"https://archive.org/details/{identifier}"
        )

        try:
            meta_res = requests.get(f"{IA_METADATA_URL}{identifier}", timeout=5)
            if meta_res.status_code == 200:
                files_data = meta_res.json().get("files", [])
                
                for f in files_data:
                    file_name = f.get("name", "")
                    fmt = f.get("format", "")
                    
                    if fmt in ["VBR MP3", "MP3", "Ogg Vorbis"] or file_name.endswith((".mp3", ".ogg")):
                        item.audio_files.append(
                            PodcastFile(
                                file_name=file_name,
                                format=fmt,
                                download_url=f"{IA_DOWNLOAD_BASE}{identifier}/{file_name}",
                                size_bytes=int(f.get("size")) if f.get("size") else None
                            )
                        )
                    
                    elif file_name.endswith(("_transcript.txt", ".vtt", ".srt")):
                        item.transcript_url = f"{IA_DOWNLOAD_BASE}{identifier}/{file_name}"

        except requests.RequestException:
             pass

        results.append(item)

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)