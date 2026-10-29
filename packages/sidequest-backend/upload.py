import io
import logging
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from supabase import ClientOptions, PostgrestAPIError, create_client

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI()
frontend_origins = [
    origin.strip()
    for origin in os.getenv("SIDEQUEST_FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
if frontend_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=frontend_origins,
        allow_methods=["POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


def authenticated_client(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in before posting.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in before posting.")

    url = os.getenv("SUPABASE_URL")
    # SUPABASE_SECRET_KEY remains supported for existing installations.
    key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise HTTPException(
            status_code=503, detail="Posting is not configured on the server."
        )

    try:
        # get_user(token) only validates identity. Every subsequent request must
        # also carry the user's JWT so storage and database RLS see the owner.
        supabase = create_client(
            url,
            key,
            options=ClientOptions(
                headers={"Authorization": f"Bearer {token}"},
                persist_session=False,
                auto_refresh_token=False,
            ),
        )
    except Exception as exc:
        logging.exception("Could not initialize the posting client")
        raise HTTPException(
            status_code=503, detail="Posting is not configured on the server."
        ) from exc

    try:
        response = supabase.auth.get_user(token)
        user = response.user if response else None
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail="Your session expired. Please sign in again."
        ) from exc
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in again.")
    return supabase, user


@app.post("/api/upload")
def upload(
    attachment: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    authorization: str | None = Header(default=None),
):
    title = title.strip()
    description = description.strip()
    if not title or len(title) > 200:
        raise HTTPException(
            status_code=400, detail="Title must be 1 to 200 characters."
        )

    supabase, user = authenticated_client(authorization)

    original = attachment.file.read(MAX_UPLOAD_BYTES + 1)
    if len(original) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail="Choose an image smaller than 10 MB."
        )

    try:
        with Image.open(io.BytesIO(original)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(
                    status_code=400, detail="Choose a JPEG, PNG, or WebP image."
                )
            if source.width * source.height > Image.MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413, detail="Choose an image under 25 megapixels."
                )
            image = ImageOps.exif_transpose(source)

        image.thumbnail((1920, 1080))
        if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
            background = Image.new("RGBA", image.size, "white")
            image = Image.alpha_composite(background, image.convert("RGBA"))

        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=80, optimize=True)
    except (
        UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError
    ) as exc:
        raise HTTPException(
            status_code=400,
            detail="This image could not be read. Choose another image.",
        ) from exc

    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "project-media")
    path = f"images/{user.id}/{uuid4().hex}.jpg"
    storage = supabase.storage.from_(bucket)
    try:
        storage.upload(
            path=path,
            file=output.getvalue(),
            file_options={"content-type": "image/jpeg"},
        )
    except Exception as exc:
        logging.exception("Project image upload failed")
        raise HTTPException(
            status_code=502, detail="Could not upload the image. Please try again."
        ) from exc

    try:
        public_url = storage.get_public_url(path)
        result = (
            supabase.table("projects")
            .insert(
                {
                    "author_id": str(user.id),
                    "title": title,
                    "description": description or None,
                    "media_urls": [public_url],
                }
            )
            .execute()
        )
        if not result.data:
            raise RuntimeError("Project insert returned no record")
    except Exception as exc:
        logging.exception("Project save failed")
        try:
            storage.remove([path])
        except Exception:
            logging.exception("Could not clean up image after project save failed")
        if isinstance(exc, PostgrestAPIError) and exc.code == "42501":
            raise HTTPException(
                status_code=403,
                detail="Your account does not have permission to save posts. Please contact support.",
            ) from exc
        raise HTTPException(
            status_code=502, detail="Could not save your post. Please try again."
        ) from exc

    return {"project": result.data[0]}


@app.delete("/api/upload")
def delete_upload(id: UUID, authorization: str | None = Header(default=None)):
    supabase, user = authenticated_client(authorization)
    url = os.environ["SUPABASE_URL"]
    try:
        rows = (
            supabase.table("projects")
            .select("id,author_id,media_urls")
            .eq("id", str(id))
            .limit(1)
            .execute()
            .data
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not find post.") from exc

    if not rows or rows[0]["author_id"] != str(user.id):
        raise HTTPException(status_code=404, detail="Post not found.")

    project = rows[0]
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
