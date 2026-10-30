import io
import logging
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from uuid import UUID, uuid4
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from supabase import AuthApiError, ClientOptions, PostgrestAPIError, create_client
from pydantic import BaseModel, Field

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
        allow_methods=["POST", "PATCH", "DELETE"],
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
    except AuthApiError as exc:
        if exc.message.strip().lower() == "invalid api key":
            logging.error("Supabase rejected the server API key")
            raise HTTPException(
                status_code=503,
                detail="Posting is not configured correctly on the server. Please contact support.",
            ) from exc
        if exc.status in (401, 403):
            raise HTTPException(
                status_code=401, detail="Your session expired. Please sign in again."
            ) from exc
        logging.error("Supabase authentication service could not verify the session")
        raise HTTPException(
            status_code=503,
            detail="Could not verify your sign-in right now. Please try again shortly.",
        ) from exc
    except Exception as exc:
        logging.error("Could not reach or read the Supabase authentication service")
        raise HTTPException(
            status_code=503,
            detail="Could not verify your sign-in right now. Please try again shortly.",
        ) from exc
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in again.")
    return supabase, user


class CollaborationRequestBody(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class CollaborationResponseBody(BaseModel):
    status: Literal["accepted", "declined"]


def collaboration_rpc(authorization, function, params):
    client, _user = authenticated_client(authorization)
    try:
        result = client.rpc(function, params).execute()
    except PostgrestAPIError as exc:
        if exc.code == "42501":
            raise HTTPException(403, "You do not have permission for this collaboration request.") from exc
        if exc.code == "22023":
            raise HTTPException(400, exc.message) from exc
        logging.exception("Could not save collaboration request")
        raise HTTPException(502, "Could not save the request. Please try again.") from exc
    except Exception as exc:
        logging.exception("Collaboration service unavailable")
        raise HTTPException(502, "Could not reach the collaboration service. Please try again.") from exc
    if not isinstance(result.data, dict) or not result.data.get("id"):
        raise HTTPException(502, "The server did not confirm the request. Refresh before retrying.")
    return {"request": result.data}


@app.post("/api/projects/{project_id}/collaboration-requests")
def request_collaboration(
    project_id: UUID,
    body: CollaborationRequestBody,
    authorization: str | None = Header(default=None),
):
    if not body.message.strip():
        raise HTTPException(400, "Write a short message about how you can help.")
    return collaboration_rpc(authorization, "request_project_collaboration", {
        "p_project_id": str(project_id), "p_message": body.message.strip(),
    })


@app.post("/api/collaboration-requests/{request_id}/response")
def respond_to_collaboration(
    request_id: UUID,
    body: CollaborationResponseBody,
    authorization: str | None = Header(default=None),
):
    return collaboration_rpc(authorization, "respond_to_collaboration_request", {
        "p_request_id": str(request_id), "p_status": body.status,
    })


def save_project_like(project_id: UUID, liked: bool, authorization: str | None):
    client, _user = authenticated_client(authorization)
    try:
        result = client.rpc("set_project_like", {
            "p_project_id": str(project_id), "p_liked": liked,
        }).execute()
    except PostgrestAPIError as exc:
        if exc.code == "42501":
            raise HTTPException(403, "This project is unavailable or you cannot like it.") from exc
        logging.exception("Could not save project like")
        raise HTTPException(502, "Could not save your like. Please try again.") from exc
    except Exception as exc:
        logging.exception("Like service unavailable")
        raise HTTPException(502, "Could not save your like. Please try again.") from exc
    data = result.data
    if (not isinstance(data, dict) or data.get("project_id") != str(project_id)
            or data.get("liked") is not liked
            or type(data.get("like_count")) is not int or data["like_count"] < 0):
        raise HTTPException(502, "The server did not confirm your like. Refresh before retrying.")
    return data


@app.post("/api/projects/{project_id}/like")
def like_project(project_id: UUID, authorization: str | None = Header(default=None)):
    return save_project_like(project_id, True, authorization)


@app.delete("/api/projects/{project_id}/like")
def unlike_project(project_id: UUID, authorization: str | None = Header(default=None)):
    return save_project_like(project_id, False, authorization)


class ProjectUpdate(BaseModel):
    title: str
    description: str | None = None


class AccountDeletion(BaseModel):
    password: str


@app.delete("/api/account")
def delete_account(
    request: AccountDeletion,
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to delete your account.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token or not request.password:
        raise HTTPException(status_code=400, detail="Enter your current password.")

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Account deletion is unavailable.")

    admin = create_client(url, key)
    try:
        user = admin.auth.get_user(token).user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sign in again.") from exc
    if not user or not user.email:
        raise HTTPException(status_code=401, detail="Sign in again.")

    # Use a separate client so password verification cannot replace the admin
    # client's service-role session before the privileged deletion call.
    verifier = create_client(url, key)
    try:
        verified = verifier.auth.sign_in_with_password(
            {"email": user.email, "password": request.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=403, detail="Incorrect password.") from exc
    if not verified.user or verified.user.id != user.id:
        raise HTTPException(status_code=403, detail="Incorrect password.")

    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "project-media")
    folder = f"images/{user.id}"
    try:
        storage = admin.storage.from_(bucket)
        while True:
            files = storage.list(folder, {"limit": 100, "offset": 0})
            paths = [
                f"{folder}/{item['name']}"
                for item in files
                if item.get("id") and item.get("name")
            ]
            if not paths:
                break
            storage.remove(paths)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not remove your uploaded files. Your account was not deleted.",
        ) from exc

    try:
        admin.auth.admin.delete_user(str(user.id))
    except Exception as exc:
        logging.exception("Account deletion failed for user %s", user.id)
        raise HTTPException(
            status_code=502,
            detail="Could not delete your account. Your uploaded files may have been removed.",
        ) from exc

    return {"deleted": True}


@app.post("/api/upload")
def upload(
    attachment: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    looking_for_collaborators: bool = Form(False),
    authorization: str | None = Header(default=None),
):

    title = title.strip()
    description = description.strip()

    #no title or title too long
    if not title or len(title) > 200:
        raise HTTPException(status_code=400, detail="err: must be 1 to 200 characters.")

    supabase, user = authenticated_client(authorization)

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
        logging.exception("Project image upload failed")
        raise HTTPException(
            status_code=502, detail="Could not upload the image. Please try again."
        ) from exc

    public_url = storage.get_public_url(path)

    #then add the resulting url into a table, which holds their title and description
    try:
        result = supabase.table("projects").insert(
            {
                "author_id": str(user.id),
                "title": title,
                "description": description or None,
                "media_urls": [public_url],
                "looking_for_collaborators": looking_for_collaborators,
            }
        ).execute()

        if not result.data:
            raise RuntimeError("nope")

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


@app.patch("/api/upload")
def update_upload(
    id: UUID,
    project: ProjectUpdate,
    authorization: str | None = Header(default=None),
):
    client, user = authenticated_client(authorization)
    title = project.title.strip()
    if not title or len(title) > 200:
        raise HTTPException(status_code=400, detail="Title must be 1 to 200 characters.")
    description = project.description.strip() if project.description else None
    try:
        result = (
            client.table("projects")
            .update({"title": title, "description": description or None})
            .eq("id", str(id))
            .eq("author_id", str(user.id))
            .select("id,title,description,created_at,media_urls")
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not update post.") from exc
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
