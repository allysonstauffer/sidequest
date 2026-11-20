import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import {
  grantEditAccess,
  listEditors,
  revokeEditAccess,
  type Editor,
  type EditAccessTarget
} from "../lib/editAccessApi";

type Props = {
  target: EditAccessTarget;
  targetId: string;
  accessToken: string;
};

export default function ManageEditors({ target, targetId, accessToken }: Props) {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    let active = true;
    listEditors(target, targetId, accessToken)
      .then((list) => active && setEditors(list))
      .catch((error) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : "Could not load editors.");
        }
      });
    return () => {
      active = false;
    };
  }, [target, targetId, accessToken, reloadKey]);

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = username.trim();
    if (!name || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .ilike("username", name.replace(/[%_\\]/g, "\\$&"))
        .limit(1);
      if (error) throw new Error("Could not look up that username.");
      const userId = data?.[0]?.user_id;
      if (typeof userId !== "string") throw new Error("No user with that username.");
      await grantEditAccess(target, targetId, userId, accessToken);
      setUsername("");
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not grant edit access.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await revokeEditAccess(target, targetId, userId, accessToken);
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not revoke edit access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Manage editors" className="manage-editors">
      <h4>Editors</h4>
      <form onSubmit={(event) => void grant(event)}>
        <label>
          Username
          <input
            value={username}
            maxLength={50}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || !username.trim()}>
          Grant edit access
        </button>
      </form>
      {editors.length === 0 ? (
        <p>No one else can edit this yet.</p>
      ) : (
        <ul>
          {editors.map((editor) => (
            <li key={editor.user_id}>
              {editor.username ?? "Unknown user"}{" "}
              <button type="button" disabled={busy} onClick={() => void revoke(editor.user_id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}
