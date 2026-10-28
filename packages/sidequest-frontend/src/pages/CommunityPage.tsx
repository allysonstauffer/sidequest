import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import DashboardLayout from "../components/DashboardLayout";
import { supabase } from "../lib/supabase";
import { useHobbyCategories } from "../hobbies/useHobbyCategories";
import {
  createHobbyCategoryId,
  validateCommunityDraft
} from "../utils/communityValidation";
import "./CommunityPage.css";

type Community = {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  hobby: string | null;
  created_at: string;
};

function parseCommunity(value: unknown): Community | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.creator_id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    (row.hobby !== null && typeof row.hobby !== "string") ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    creator_id: row.creator_id,
    name: row.name,
    description: row.description,
    hobby: row.hobby,
    created_at: row.created_at
  };
}

function CommunityPage() {
  const { session } = useAuth();
  const {
    categories,
    status: categoryStatus,
    reload: reloadCategories
  } = useHobbyCategories();
  const [communities, setCommunities] = useState<Community[]>(
    []
  );
  const [status, setStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] =
    useState(false);
  const [isSavingCategory, setIsSavingCategory] =
    useState(false);
  const [categoryNotice, setCategoryNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCommunities() {
      setStatus("loading");
      try {
        const { data, error } = await supabase
          .from("communities")
          .select(
            "id,creator_id,name,description,hobby,created_at"
          )
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);

        const parsed = (data ?? []).map(parseCommunity);
        if (parsed.some((community) => community === null)) {
          throw new Error("A community record is malformed.");
        }
        if (!active) return;
        setCommunities(
          parsed.filter(
            (community): community is Community =>
              community !== null
          )
        );
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadCommunities();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function createCommunity(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!session || isSaving) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const draft = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      hobby: String(formData.get("hobby") ?? "")
    };
    const validationError = validateCommunityDraft(
      draft,
      categories.map(({ id }) => id)
    );
    if (validationError) {
      setNotice(validationError);
      return;
    }
    setIsSaving(true);
    setNotice("");
    try {
      const { error } = await supabase
        .from("communities")
        .insert({
          creator_id: session.user.id,
          name: draft.name.trim(),
          description: draft.description.trim(),
          hobby: draft.hobby || null
        });
      if (error) throw new Error(error.message);
      setShowForm(false);
      form.reset();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to create the community."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createCategory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!session || isSavingCategory) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(
      formData.get("category_name") ?? ""
    ).trim();
    const id = createHobbyCategoryId(name);
    if (!name || name.length > 80 || !id) {
      setCategoryNotice(
        "Enter a category name between 1 and 80 characters using letters or numbers."
      );
      return;
    }

    setIsSavingCategory(true);
    setCategoryNotice("");
    try {
      const { error } = await supabase
        .from("hobby_categories")
        .insert({
          id,
          name,
          creator_id: session.user.id
        });
      if (error) throw new Error(error.message);
      form.reset();
      setShowCategoryForm(false);
      reloadCategories();
    } catch (error) {
      setCategoryNotice(
        error instanceof Error
          ? error.message
          : "Unable to create the hobby category."
      );
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="page-shell page-shell--compact">
        <div className="page-header">
          <div>
            <p className="eyebrow">Community</p>
            <h2>Creative circles</h2>
          </div>
          <div className="community-header-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setShowCategoryForm((current) => !current);
                setCategoryNotice("");
              }}>
              {showCategoryForm
                ? "Cancel category"
                : "Create a hobby category"}
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowForm((current) => !current);
                setNotice("");
              }}>
              {showForm ? "Cancel" : "Create a community"}
            </button>
          </div>
        </div>

        {showCategoryForm && (
          <form
            className="community-create-form"
            onSubmit={(event) => void createCategory(event)}>
            <label>
              <span>New hobby category name</span>
              <input
                name="category_name"
                maxLength={80}
                required
              />
            </label>
            <button type="submit" disabled={isSavingCategory}>
              {isSavingCategory
                ? "Creating…"
                : "Create hobby category"}
            </button>
            {categoryNotice && (
              <p role="alert">{categoryNotice}</p>
            )}
          </form>
        )}

        {categoryStatus === "error" && (
          <p role="alert">
            Could not load hobby categories. Check that the
            hobby categories migration has been applied.
          </p>
        )}

        {showForm && (
          <form
            className="community-create-form"
            onSubmit={(event) => void createCommunity(event)}>
            <label>
              <span>Community name</span>
              <input name="name" maxLength={100} required />
            </label>
            <label>
              <span>Hobby category (optional)</span>
              <select name="hobby" defaultValue="">
                <option value="">No category</option>
                {categories.map(({ id, name }) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Description</span>
              <textarea
                name="description"
                maxLength={1000}
                rows={4}
              />
            </label>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Creating…" : "Create community"}
            </button>
            {notice && <p role="alert">{notice}</p>}
          </form>
        )}

        {status === "loading" && (
          <p role="status">Loading communities…</p>
        )}
        {status === "error" && (
          <div role="alert">
            <p>
              Could not load communities. Check that the
              communities migration has been applied.
            </p>
            <button
              type="button"
              onClick={() =>
                setReloadKey((value) => value + 1)
              }>
              Try again
            </button>
          </div>
        )}
        {status === "ready" && communities.length === 0 && (
          <p className="empty-state">
            No communities yet. Start one for your favorite
            hobby.
          </p>
        )}
        {status === "ready" && communities.length > 0 && (
          <div className="community-list">
            {communities.map((community) => (
              <article
                className="community-card"
                key={community.id}>
                {community.hobby && (
                  <p className="eyebrow">
                    {categories.find(
                      ({ id }) => id === community.hobby
                    )?.name ?? community.hobby}
                  </p>
                )}
                <h3>{community.name}</h3>
                {community.description && (
                  <p>{community.description}</p>
                )}
                <Link
                  to={`/profile/${community.creator_id}`}
                  className="community-creator-link">
                  View creator profile
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default CommunityPage;
