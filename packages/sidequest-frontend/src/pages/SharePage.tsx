import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { publishProject } from "../lib/projectApi";
import { compressImage } from "../components/compression";
import { supabase } from "../lib/supabase";
import SidequestEvents from "../components/SidequestEvents";

function SharePage() {
  const [notice, setNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const publishingRef = useRef(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  async function handlePublish(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (publishingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const file = formData.get("attachment");
    if (!(file instanceof File) || file.size === 0) {
      setNotice("Choose an image to share.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.type
      )
    ) {
      setNotice("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    const title = formData.get("title");
    if (typeof title !== "string" || !title.trim()) {
      setNotice("Enter a title for your side quest.");
      return;
    }
    formData.set("title", title.trim());
    if (!session) {
      setNotice("Sign in before posting.");
      return;
    }

    publishingRef.current = true;
    setIsUploading(true);
    setNotice("Preparing your image…");
    try {
      const compressed = await compressImage(file);
      if (compressed.size > 10 * 1024 * 1024) {
        throw new Error(
          "This image is still too large. Choose a smaller image."
        );
      }
      formData.set("attachment", compressed, compressed.name);

      // Compression can take time; refresh an expired session before sending.
      const { data, error } = await supabase.auth.getSession();
      if (
        error ||
        !data.session ||
        data.session.user.id !== session.user.id
      ) {
        throw new Error(
          "Your session changed. Please sign in again before posting."
        );
      }
      setNotice("Uploading your side quest…");
      await publishProject(formData, data.session.access_token);
      navigate("/feed");
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "Could not reach the server. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Could not publish your post. Please try again."
      );
    } finally {
      setIsUploading(false);
      publishingRef.current = false;
    }
  }

  return (
    <DashboardLayout>

      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">Create</p>
            <h2>Share a project</h2>
          </div>
        </div>

        <form className="form-card" onSubmit={handlePublish}>
          <label className="field-group">
            <span>Title</span>
            <input
              name="title"
              placeholder="Give your side quest a title"
              maxLength={200}
              required
            />
          </label>
          <label className="field-group">
            <span>Attachments</span>
            <input
              type="file"
              name="attachment"
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploading}
              required
            />

            <span>What are you making?</span>
            <textarea
              name="description"
              placeholder="Share what you are making"
              disabled={isUploading}
              required
            />
          </label>
          <label className="collaboration-option">
            <input
              type="checkbox"
              name="looking_for_collaborators"
              value="true"
              disabled={isUploading}
            />

            <span>I&apos;m looking for help or collaborators</span>
          </label>
          <div className="submit-row">
            <button
              type="submit"
              className="primary-button"
              disabled={isUploading}>
              {isUploading ? "sharing…" : "Share project"}
            </button>
          </div>
          {notice && (
            <p className="empty-state" role="status">
              {notice}
            </p>
          )}
        </form>

        <div className="share-sidequest">
          <SidequestEvents
            viewerId={session?.user.id ?? ""}
            title="Create a SideQuest"
            allowCreate
            creationOnly
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default SharePage;
