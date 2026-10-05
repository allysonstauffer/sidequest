import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { saveSetup } from "../onboardingData";
import type { Hobby, Setup } from "../onboardingData";
import type { User } from "@supabase/supabase-js";

export default function Onboarding({
  user,
  setup,
  onComplete
}: {
  user: User;
  setup: Setup;
  onComplete: React.Dispatch<Setup>;
}) {
  const [username, setUsername] = useState(
    setup.profile?.username ?? ""
  );
  const [displayName, setDisplayName] = useState(
    setup.profile?.display_name ??
      user.user_metadata?.full_name ??
      ""
  );
  const [hobbies, setHobbies] = useState<Hobby[]>([
    { hobby: "", experience_level: "Beginner" }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const handleHobbyChange = (
    index: number,
    field: keyof Hobby,
    value: string
  ) => {
    const updated = [...hobbies];
    updated[index] = { ...updated[index], [field]: value };
    setHobbies(updated);
  };
  const addHobbyField = () => {
    setHobbies([
      ...hobbies,
      { hobby: "", experience_level: "Beginner" }
    ]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    setError("");
    try {
      const saved = await saveSetup(
        supabase,
        user.id,
        username,
        displayName,
        hobbies
      );
      onComplete(saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your setup. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "400px",
        margin: "2rem auto",
        textAlign: "left"
      }}>
      <h2>Complete Your Profile</h2>
      <p>
        Choose your username, display name, and hobbies with a
        skill level for each.
      </p>
      {error && <p role="alert">{error}</p>}
      <fieldset
        disabled={submitting}
        style={{ border: 0, padding: 0, minWidth: 0 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="username">Username</label>
          <br />
          <input
            required
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase())
            }
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="display-name">Display Name</label>
          <br />
          <input
            required
            id="display-name"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <h3>Your Hobbies</h3>
        {setup.hobbies.map((item, index) => (
          <p key={index}>
            {item.hobby} — {item.experience_level}
          </p>
        ))}
        {hobbies.map((h, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "0.5rem"
            }}>
            <input
              aria-label={`Hobby ${i + 1}`}
              required={i === 0 && setup.hobbies.length === 0}
              placeholder="e.g. Bouldering, Coding"
              value={h.hobby}
              onChange={(e) =>
                handleHobbyChange(i, "hobby", e.target.value)
              }
              style={{ flex: 1 }}
            />
            <select
              aria-label={`Skill level for hobby ${i + 1}`}
              value={h.experience_level}
              onChange={(e) =>
                handleHobbyChange(
                  i,
                  "experience_level",
                  e.target.value
                )
              }>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>
        ))}

        <button
          type="button"
          onClick={addHobbyField}
          style={{ marginBottom: "1rem" }}>
          + Add Hobby
        </button>
        <br />
        <button
          type="submit"
          disabled={submitting}
          style={{ width: "100%" }}>
          {submitting ? "Saving..." : "Finish Setup"}
        </button>
      </fieldset>
    </form>
  );
}
