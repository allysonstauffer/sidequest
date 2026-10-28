import io
import logging
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from supabase import create_client

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


@app.post("/api/upload")
def upload(
    attachment: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    beginner_friendly: bool = Form(False),
    authorization: str | None = Header(default=None),
):
    
    title = title.strip()
    description = description.strip()
    
    #no title or title too long
    if not title or len(title) > 200:
        raise HTTPException(status_code=400, detail="err: must be 1 to 200 characters.")
    
    #not authorized to upload
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="sign in")
    
    token = authorization.removeprefix("Bearer ").strip()
    
    #no user
    if not token:
        raise HTTPException(status_code=401, detail="sign in")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    
    #no supabase key
    if not url or not key:
        raise HTTPException(status_code=503, detail="")

    supabase = create_client(url, key)
    
    #try to get user name, if not, then tell them to sign in
    try:
        user = supabase.auth.get_user(token).user
    
    except Exception as exc:
        raise HTTPException(status_code=401, detail="sign in") from exc
    
    if not user:
        raise HTTPException(status_code=401, detail="sign in")

    original = attachment.file.read(MAX_UPLOAD_BYTES + 1)
    
    #if file size is too large, error out
    if len(original) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="image file toooo large")
    
    #try to open file, if file isn't a proper file format, error out, elif it's pixel size is too large, error out
    try:
        with Image.open(io.BytesIO(original)) as source:
            
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status_code=400, detail="choose the right type of image")
            
            if source.width * source.height > Image.MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="image toooo large")
            
            image = ImageOps.exif_transpose(source)

        image.thumbnail((1920, 1080))
        
        if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
            background = Image.new("RGBA", image.size, "white")
            image = Image.alpha_composite(background, image.convert("RGBA"))

        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=80, optimize=True)
        
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="this is NOT an image") from exc

    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "project-media")
    path = f"images/{user.id}/{uuid4().hex}.jpg"
    storage = supabase.storage.from_(bucket)
    
    #actual supabase insertion time, try uploading file into our storage, else err if didn't work
    try:
        storage.upload(
            path=path,
            file=output.getvalue(),
            file_options={"content-type": "image/jpeg"},
        )
    
    except Exception as exc:
        raise HTTPException(status_code=502, detail="didnt upload") from exc

    public_url = storage.get_public_url(path)
    
    #then add the resulting url into a table, which holds their title and description
    try:
        result = supabase.table("projects").insert(
            {
                "author_id": str(user.id),
                "title": title,
                "description": description or None,
                "media_urls": [public_url],
                "beginner_friendly": beginner_friendly,
            }
        ).execute()
        
        if not result.data:
            raise RuntimeError("nope")
       
    except Exception as exc:
        try:
            storage.remove([path])
            
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="cant save") from exc

    return {"project": result.data[0]}

#delete post
@app.delete("/api/upload")
def delete_upload(id: UUID, authorization: str | None = Header(default=None)):
    
    #not authorized, no deletion
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="sign in!")
    
    token = authorization.removeprefix("Bearer ").strip()
    
    #no token, no deletion
    if not token:
        raise HTTPException(status_code=401, detail="sign in!")
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    
    #how to delete with no supabase key
    if not url or not key:
        raise HTTPException(status_code=503, detail="no supabase key")

    supabase = create_client(url, key)
    
    #get user, but if not, error
    try:
        user = supabase.auth.get_user(token).user
        
    except Exception as exc:
        raise HTTPException(status_code=401, detail="sign in again.") from exc
    
    if not user:
        raise HTTPException(status_code=401, detail="sign in again.")
    
    #try to find post in the table
    try:
        rows = (
            supabase.table("projects")
            .select("id,author_id,media_urls")
            .eq("id", str(id))
            .limit(1)
            .execute()
            .data
        )
        
    #cant find the post
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not find post.") from exc

    if not rows or rows[0]["author_id"] != str(user.id):
        raise HTTPException(status_code=404, detail="Post not found.")

    project = rows[0]
    
    #try deleting the post, if not error
    try:
        result = (
            supabase.table("projects")
            .delete()
            .eq("id", str(id))
            .eq("author_id", str(user.id))
            .select("id")
            .execute()
        )
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found.")
        
    except HTTPException:
        raise
   
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not delete post.") from exc

    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "project-media")
    prefix = f"/storage/v1/object/public/{bucket}/"
    owner_prefix = f"images/{user.id}/"
    storage_paths = []
    
    #asking supabase to remove the post image from the storage  
    for media_url in project.get("media_urls") or []:
        parsed = urlparse(media_url)
        path = unquote(parsed.path)
        
        if parsed.netloc == urlparse(url).netloc and path.startswith(prefix):
            object_path = path[len(prefix):]
            if object_path.startswith(owner_prefix):
                storage_paths.append(object_path)

    if storage_paths:
        
        try:
            supabase.storage.from_(bucket).remove(storage_paths)
            
        except Exception:
            logging.exception("Post %s was deleted, but image cleanup failed", id)
            return {"deleted": True, "media_cleanup": False}

    return {"deleted": True, "media_cleanup": True}
