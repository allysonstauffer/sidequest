import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { saveProjectCollaboration } from "../lib/projectCollaboration";

interface Props {
  projectId: string;
  active: boolean;
  disabled?: boolean;
  onChange: (active: boolean) => void;
}

export default function ProjectCollaborationToggle({
  projectId,
  active,
  disabled = false,
  onChange
}: Props) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const savingRef = useRef(false);

  async function toggle() {
    if (disabled || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setNotice("");

    try {
      const savedFlag = await saveProjectCollaboration(
        supabase,
        projectId,
        !active
      );
      // Update the card only after the database confirms the saved value.
      onChange(savedFlag);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not update the collaboration status."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="project-collaboration-control">
      <button
        type="button"
        className="project-collaboration-button"
        disabled={disabled || saving}
        onClick={() => void toggle()}>
        {saving
          ? "Saving…"
          : active
            ? "Stop looking for collaborators"
            : "Look for collaborators"}
      </button>
      {notice && <p role="alert">{notice}</p>}
    </div>
  );
}
