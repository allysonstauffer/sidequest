import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./CreatorProfile.css";

type CreatorLink = { label: string; url: string };
type Creator = {
  user_id: string;
  username: string | null;
  bio: string;
  avatar_url: string | null;
  links: CreatorLink[];
};

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function storedAvatarPath(userId: string, avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const prefix = supabase.storage
    .from("creator-avatars")
    .getPublicUrl(`${userId}/`).data.publicUrl;
  if (!avatarUrl.startsWith(prefix)) return null;
  const filename = avatarUrl.slice(prefix.length).split("?")[0];
  return filename && !filename.includes("/")
    ? `${userId}/${filename}`
    : null;
}

function parseCreator(value: unknown): Creator | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.user_id !== "string" ||
    (row.username !== null && typeof row.username !== "string") ||
    typeof row.bio !== "string" ||
    (row.avatar_url !== null && typeof row.avatar_url !== "string") ||
    !Array.isArray(row.links)
  ) return null;
  const links = row.links.filter((link): link is CreatorLink =>
    Boolean(
      link && typeof link === "object" &&
      typeof link.label === "string" &&
      typeof link.url === "string" && safeUrl(link.url)
    )
  );
  return {
    user_id: row.user_id,
    username: row.username as string | null,
    bio: row.bio,
    avatar_url: row.avatar_url as string | null,
    links
  };
}

export default function CreatorProfile({
  userId,
  editable = false,
  followRefreshKey = 0
}: {
  userId: string;
  editable?: boolean;
  followRefreshKey?: number;
}) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [followCounts, setFollowCounts] = useState({
    followers: 0,
    following: 0
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [picture, setPicture] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      const [profileResult, followResult] = await Promise.all([
        supabase
          .from("creator_profiles")
          .select("user_id,username,bio,avatar_url,links")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.rpc("get_creator_follow_counts", {
          p_user_id: userId
        })
      ]);
      if (!active) return;
      const parsed = parseCreator(profileResult.data);
      if (profileResult.error || !parsed) {
        setStatus("error");
        return;
      }
      setCreator(parsed);
      const counts = followResult.data?.[0];
      if (!followResult.error && counts) {
        setFollowCounts({
          followers: Number(counts.follower_count) || 0,
          following: Number(counts.following_count) || 0
        });
      }
      setStatus("ready");
    }
    void load();
    return () => { active = false; };
  }, [followRefreshKey, userId]);

  function startEditing() {
    if (!creator) return;
    setBio(creator.bio);
    setLinks(creator.links);
    setPicture(null);
    setRemovePicture(false);
    setNotice("");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creator || saving) return;
    const cleanedLinks: CreatorLink[] = [];
    for (const link of links) {
      const label = link.label.trim();
      const rawUrl = link.url.trim();
      if (!label && !rawUrl) continue;
      const url = safeUrl(rawUrl);
      if (!label || label.length > 40 || !url || url.length > 2048) {
        setNotice("Each link needs a label and a valid http or https URL.");
        return;
      }
      cleanedLinks.push({ label, url });
    }
    if (bio.length > 500) {
      setNotice("Bio must be 500 characters or fewer.");
      return;
    }
    if (picture && (
      picture.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(picture.type)
    )) {
      setNotice("Choose a JPG, PNG, or WebP picture under 2 MB.");
      return;
    }

    setSaving(true);
    setNotice("");
    let uploadedPath: string | null = null;
    try {
      let avatarUrl = removePicture ? null : creator.avatar_url;
      if (picture && !removePicture) {
        const extension = picture.type === "image/png"
          ? "png" : picture.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("creator-avatars")
          .upload(uploadedPath, picture, { contentType: picture.type });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage
          .from("creator-avatars")
          .getPublicUrl(uploadedPath).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("creator_profiles")
        .update({ bio: bio.trim(), avatar_url: avatarUrl, links: cleanedLinks })
        .eq("user_id", userId)
        .select("user_id,username,bio,avatar_url,links")
        .single();
      if (error) throw error;
      const updated = parseCreator(data);
      if (!updated) throw new Error("The saved profile was invalid.");
      setCreator(updated);
      setEditing(false);
      setPicture(null);
      setNotice("Profile updated.");
      if (creator.avatar_url !== updated.avatar_url) {
        const oldPath = storedAvatarPath(userId, creator.avatar_url);
        if (oldPath) {
          void supabase.storage.from("creator-avatars").remove([oldPath]);
        }
      }
    } catch (error) {
      if (uploadedPath) {
        void supabase.storage.from("creator-avatars").remove([uploadedPath]);
      }
      setNotice(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") return <p role="status">Loading</p>;
  if (status === "error" || !creator) {
    return <p role="alert">Profile unavailable. Please try again.</p>;
  }

  return (
    <section>
      <div className="creator-profile-header">
        {creator.avatar_url ? (
          <img className="creator-avatar" src={creator.avatar_url} alt={`${creator.username ?? "Creator"}'s profile`} />
        ) : (
          <div className="creator-avatar creator-avatar-fallback" aria-hidden="true">
            {(creator.username ?? "S").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="site-eyebrow"></p>
          <h1>{creator.username ?? "SideQuest member"}</h1>
        </div>
      </div>
      <dl className="creator-follow-counts" aria-label="Creator connections">
        <div>
          <dd>{followCounts.followers.toLocaleString()}</dd>
          <dt>{followCounts.followers === 1 ? "Follower" : "Followers"}</dt>
        </div>
        <div>
          <dd>{followCounts.following.toLocaleString()}</dd>
          <dt>Following</dt>
        </div>
      </dl>
      {creator.bio ? <p className="creator-bio">{creator.bio}</p> : <p className="creator-bio">No bio yet.</p>}
      {creator.links.length > 0 && (
        <ul className="creator-links">
          {creator.links.map((link, index) => (
            <li key={`${link.url}-${index}`}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
            </li>
          ))}
        </ul>
      )}
      {editable && !editing && (
        <button type="button" className="site-button" onClick={startEditing}>Edit creator profile</button>
      )}
      {notice && <p role="status" className="site-notice">{notice}</p>}
      {editable && editing && (
        <form className="site-form creator-profile-form" onSubmit={(event) => void save(event)} aria-busy={saving}>
          <label>
            Bio
            <textarea value={bio} maxLength={500} rows={4} onChange={(event) => setBio(event.target.value)} />
          </label>
          <label>
            Profile picture (JPG, PNG, or WebP; 2 MB max)
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={removePicture} onChange={(event) => setPicture(event.target.files?.[0] ?? null)} />
          </label>
          {creator.avatar_url && (
            <label className="creator-remove-picture">
              <input type="checkbox" checked={removePicture} onChange={(event) => setRemovePicture(event.target.checked)} />
              Remove current picture
            </label>
          )}
          <fieldset>
            <legend>Links</legend>
            {Array.from({ length: 5 }, (_, index) => (
              <div className="creator-link-fields" key={index}>
                <input aria-label={`Link ${index + 1} label`} placeholder="Label" maxLength={40} value={links[index]?.label ?? ""} onChange={(event) => setLinks((current) => {
                  const next = [...current];
                  next[index] = { label: event.target.value, url: next[index]?.url ?? "" };
                  return next;
                })} />
                <input aria-label={`Link ${index + 1} URL`} placeholder="https://example.com" type="url" value={links[index]?.url ?? ""} onChange={(event) => setLinks((current) => {
                  const next = [...current];
                  next[index] = { label: next[index]?.label ?? "", url: event.target.value };
                  return next;
                })} />
              </div>
            ))}
          </fieldset>
          <div className="creator-profile-actions">
            <button type="submit" className="site-button site-button-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            <button type="button" className="site-button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
