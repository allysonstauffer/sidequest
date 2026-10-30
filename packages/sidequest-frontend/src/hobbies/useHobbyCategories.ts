import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type HobbyCategory = {
  id: string;
  name: string;
};

type Status = "loading" | "ready" | "error";

export function useHobbyCategories() {
  const [categories, setCategories] = useState<HobbyCategory[]>(
    []
  );
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      try {
        const { data, error } = await supabase
          .from("hobby_categories")
          .select("id,name")
          .order("name");
        if (error) throw new Error(error.message);
        const parsed = (data ?? []).map((value: unknown) => {
          if (!value || typeof value !== "object") {
            throw new Error("A hobby category is malformed.");
          }
          const row = value as Record<string, unknown>;
          if (
            typeof row.id !== "string" ||
            typeof row.name !== "string"
          ) {
            throw new Error("A hobby category is malformed.");
          }
          return { id: row.id, name: row.name };
        });
        if (!active) return;
        setCategories(parsed);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(
    () => setReloadKey((current) => current + 1),
    []
  );

  return { categories, status, reload };
}
