import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  isSetupComplete,
  loadSetup,
  saveSetup
} from "../src/onboardingData.ts";

const profile = {
  id: "test-user",
  username: "hobbyist",
  display_name: "Hobbyist"
};
const hobby = {
  hobby: "Drawing",
  experience_level: "Beginner"
};

// Exercise the real Supabase query builder against an in-memory REST endpoint.
function database(initialProfile = null, initialHobbies = []) {
  const state = {
    profile: initialProfile,
    hobbies: [...initialHobbies],
    fail: "",
    writes: 0
  };
  const client = createClient(
    "https://example.supabase.co",
    "test-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        fetch: async (input, init) => {
          const url = new URL(input);
          const table = url.pathname.split("/").at(-1);
          if (state.fail === `${init.method}:${table}`) {
            return Response.json(
              { message: "permission denied", code: "42501" },
              { status: 403 }
            );
          }
          if (init.method === "GET") {
            assert.equal(
              url.searchParams.get(
                table === "profiles" ? "id" : "user_id"
              ),
              "eq.test-user"
            );
            return Response.json(
              table === "profiles"
                ? state.profile
                  ? [state.profile]
                  : []
                : state.hobbies
            );
          }
          state.writes++;
          const body = JSON.parse(init.body);
          if (table === "profiles") {
            assert.equal(
              url.searchParams.get("on_conflict"),
              "id"
            );
            state.profile = body;
            return Response.json(body);
          }
          state.hobbies.push(...body);
          return new Response(null, { status: 201 });
        }
      }
    }
  );
  return { client, state };
}

test("new users and returning users without hobbies need setup", async () => {
  for (const savedProfile of [null, profile]) {
    const { client } = database(savedProfile);
    assert.equal(
      isSetupComplete(await loadSetup(client, profile.id)),
      false
    );
  }
});

test("complete users skip setup while missing profile details require it", async () => {
  const { client } = database(profile, [hobby]);
  assert.equal(
    isSetupComplete(await loadSetup(client, profile.id)),
    true
  );
  assert.equal(
    isSetupComplete({
      profile: { ...profile, username: " " },
      hobbies: [hobby]
    }),
    false
  );
});

test("read failures are surfaced rather than treated as missing profiles", async () => {
  for (const table of ["profiles", "user_hobbies"]) {
    const { client, state } = database(profile);
    state.fail = `GET:${table}`;
    await assert.rejects(
      loadSetup(client, profile.id),
      /permission denied/
    );
  }
});

test("blank hobbies cannot finish setup", async () => {
  const { client, state } = database();
  await assert.rejects(
    saveSetup(
      client,
      profile.id,
      profile.username,
      profile.display_name,
      [{ ...hobby, hobby: " " }]
    ),
    /at least one hobby/
  );
  assert.equal(state.writes, 0);
});

test("hobby save failures keep setup incomplete and retry recovers the saved profile", async () => {
  const { client, state } = database();
  state.fail = "POST:user_hobbies";
  const save = () =>
    saveSetup(
      client,
      profile.id,
      profile.username,
      profile.display_name,
      [hobby]
    );
  await assert.rejects(save(), /Unable to save your hobbies/);
  assert.deepEqual(state.profile, profile);
  assert.equal(
    isSetupComplete(await loadSetup(client, profile.id)),
    false
  );
  state.fail = "";
  assert.equal(isSetupComplete(await save()), true);
  await save();
  assert.equal(state.hobbies.length, 1);
});

test("profile save failures prevent hobby writes", async () => {
  const { client, state } = database();
  state.fail = "POST:profiles";
  await assert.rejects(
    saveSetup(
      client,
      profile.id,
      profile.username,
      profile.display_name,
      [hobby]
    ),
    /Unable to save your profile/
  );
  assert.equal(state.hobbies.length, 0);
});

test("existing profiles can add hobbies and submitted hobby duplicates are removed", async () => {
  const { client, state } = database(profile);
  const saved = await saveSetup(
    client,
    profile.id,
    " hobbyist ",
    " Hobbyist ",
    [hobby, { ...hobby, hobby: " drawing " }]
  );
  assert.equal(isSetupComplete(saved), true);
  assert.equal(state.hobbies.length, 1);
  assert.deepEqual(state.profile, profile);
});
