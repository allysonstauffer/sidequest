import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { isSetupComplete, loadSetup } from "../onboardingData";
import type { Setup } from "../onboardingData";
import Onboarding from "./Onboarding";

export default function ProfileGate({ user }: { user: User }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadSetup(supabase, user.id)
      .then((data) => {
        if (active) {
          setSetup(data);
          setError("");
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your account."
          );
      });
    return () => {
      active = false;
    };
  }, [user.id, attempt]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }

  if (error)
    return (
      <div>
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}>
          Retry
        </button>
        <button onClick={signOut}>Sign Out</button>
      </div>
    );
  if (!setup)
    return (
      <p role="status">Loading your profile and hobbies...</p>
    );

  return (
    <div>
      {isSetupComplete(setup) ? (
        <h1>
          Welcome back to SideQuest,{" "}
          {setup.profile?.display_name}!
        </h1>
      ) : (
        <Onboarding
          user={user}
          setup={setup}
          onComplete={setSetup}
        />
      )}
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
