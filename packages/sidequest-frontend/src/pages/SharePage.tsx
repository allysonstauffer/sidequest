import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";

function SharePage() {
  const [notice, setNotice] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  async function handlePublish(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("attachment");
    if (!(file instanceof File) || file.size === 0) {
      setNotice("upload image.");
      return;
    }
    if (!session) {
      setNotice("sign in.");
      return;
    }

    setIsUploading(true);
    setNotice("uploading");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "upload unavailable"
        );
      }
      navigate("/feed");
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "try again later"
          : error instanceof Error
            ? error.message
            : "try again later"
      );
    } finally {
      setIsUploading(false);
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
              required
            />

            <span>What are you making?</span>
            <textarea
              name="description"
              placeholder="Share what you are making"
              required
            />
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
      </div>
    </DashboardLayout>
  );
}

export default SharePage;
