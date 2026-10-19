import { supabase } from "../lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreference, validatePreferences } from "./model";

import type { PreferenceService } from "./model";

export function createSupabasePreferenceService(
  client: Pick<SupabaseClient, "from" | "rpc">
): PreferenceService {
  return {
    async load(userId) {
      if (!userId)
        throw new Error("Sign in to load your interests.");
      const [profileResult, hobbiesResult] = await Promise.all([
        client
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("id", userId)
          .maybeSingle(),
        client
          .from("user_hobbies")
          .select("hobby, experience_level")
          .eq("user_id", userId)
          .order("hobby")
      ]).catch((cause) => {
        throw new Error(
          "Unable to load your interests. Please try again.",
          { cause }
        );
      });

      if (profileResult.error || hobbiesResult.error) {
        throw new Error(
          "Unable to load your interests. Please try again.",
          {
            cause: profileResult.error ?? hobbiesResult.error
          }
        );
      }

      const rows: unknown[] = hobbiesResult.data ?? [];
      if (!rows.every(isPreference)) {
        throw new Error(
          "Some saved interests use unsupported values. Please contact support before editing."
        );
      }
      if (
        new Set(rows.map(({ hobby }) => hobby)).size !==
        rows.length
      ) {
        throw new Error(
          "Your saved interests contain duplicates. Please contact support before editing."
        );
      }
      return {
        complete:
          Boolean(
            profileResult.data?.onboarding_completed_at
          ) && rows.length > 0,
        preferences: rows
      };
    },

    async save(preferences) {
      const validationError = validatePreferences(preferences);
      if (validationError) throw new Error(validationError);
      try {
        const { error } = await client.rpc(
          "save_my_preferences",
          { p_preferences: preferences }
        );

        if (error) {
          throw new Error(error.message);
        }
      } catch (cause) {
        throw new Error(
          "Unable to save your interests. Please try again.",
          { cause }
        );
      }
    }
  };
}

export const supabasePreferenceService =
  createSupabasePreferenceService(supabase);
