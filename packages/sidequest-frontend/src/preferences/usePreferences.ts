import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  toPreferences,
  toSelection
} from "./model";

import type {
  HobbySelection,
  Preference,
  PreferenceService,
  PreferencesSnapshot
} from "./model";

interface LoadResult {
  key: string;
  data: PreferencesSnapshot | null;
  error: string | null;
}

export function usePreferences(
  userId: string,
  service: PreferenceService
) {
  const [version, setVersion] = useState(0);
  const [result, setResult] =
    useState<LoadResult | null>(null);

  const key = `${userId}:${version}`;

  useEffect(() => {
    if (!userId) return;

    let active = true;

    service.load(userId).then(
      (data) => {
        if (active) {
          setResult({ key, data, error: null });
        }
      },
      (error: unknown) => {
        if (active) {
          setResult({
            key,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load preferences."
          });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [userId, key, service]);

  const current =
    result?.key === key ? result : null;

  return {
    loading: current === null,
    data: current?.data ?? null,
    error: current?.error ?? null,
    reload: () => setVersion((value) => value + 1)
  };
}

export function usePreferenceDraft(
  initialPreferences: Preference[],
  service: PreferenceService
) {
  const [selection, setSelection] =
    useState<HobbySelection>(() =>
      toSelection(initialPreferences)
    );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  function changeSelection(next: HobbySelection) {
    if (savingRef.current) return;
    setSelection(next);
    setError("");
  }

  async function save() {
    if (savingRef.current) return false;

    const preferences = toPreferences(selection);

    if (preferences.length === 0) {
      setError("Select at least one hobby.");
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      await service.save(preferences);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save preferences."
      );

      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return {
    selection,
    changeSelection,
    saving,
    error,
    save
  };
}
