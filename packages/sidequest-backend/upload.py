import io
import os
import vt
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI()
client = vt.Client(os.getenv("VIRUSTOTAL_API_KEY"))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000
#still need to check file for malware

@app.post("/api/upload")
def upload(attachment):
    #supposed to be file checking but dont work so thats a later issue
    # with open(attachment,"rb") as f:
    #     analyze = client.scan_file(f)
    # if analyze.last_analysis_stats.getKey("suspicious")>0:
    #     raise HTTPException(status_code=100, detail="malicious file detected")
    original = attachment.file.read(MAX_UPLOAD_BYTES + 1)
    
    if len(original) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="image too large")

    try:
        with Image.open(io.BytesIO(original)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status_code=400, detail="image only")
            if source.width * source.height > Image.MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="image size too large")
            image = ImageOps.exif_transpose(source)

        image.thumbnail((1920, 1080))
        if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
            background = Image.new("RGBA", image.size, "white")
            image = Image.alpha_composite(background, image.convert("RGBA"))

        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=80, optimize=True)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="nope")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise HTTPException(status_code=503, detail="fix supabase")

    path = f"images/{uuid4().hex}.jpg"
    supabase = create_client(url, key)
    supabase.storage.from_(os.getenv("SUPABASE_STORAGE_BUCKET", "project-media")).upload(
        path=path,
        file=output.getvalue(),
        file_options={"content-type": "image/jpeg"},
    )
    return {"path": path, "original_bytes": len(original), "stored_bytes": output.tell()}
