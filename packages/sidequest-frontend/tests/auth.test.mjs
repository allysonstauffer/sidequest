import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");
let passed = 0;
function harness(
  file,
  auth = { session: null, loading: false },
  location = {}
) {
  const states = [],
    calls = [],
    effects = [],
    cache = new Map();
  let cursor = 0;
  const api = {};
  for (const method of [
    "signInWithPassword",
    "signUp",
    "resetPasswordForEmail",
    "updateUser",
    "signOut",
    "resend"
  ]) {
    api[method] = async (input, options) => {
      calls.push({ method, input, options });
      return {
        data: {
          session: method === "signInWithPassword" ? { user: { email: input.email } } : null,
          user:
            method === "signUp"
              ? {
                  email: input.email,
                  role: "authenticated",
                  identities: [{ provider: "email" }],
                  confirmation_sent_at: "2026-10-14T12:00:00Z"
                }
              : null
        },
        error: null
      };
    };
  }
  api.onAuthStateChange = (callback) => {
    api.emit = callback;
    return {
      data: {
        subscription: {
          unsubscribe() {
            api.unsubscribed = true;
          }
        }
      }
    };
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states))
        states[slot] =
          typeof initial === "function" ? initial() : initial;
      return [
        states[slot],
        (value) => {
          states[slot] =
            typeof value === "function" ? value(states[slot]) : value;
        }
      ];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = { current: initial };
      return states[slot];
    },
    useEffect(callback) {
      effects.push(callback);
    },
    createContext: () => ({ Provider: "Provider" }),
    useContext: () => auth
  };
  const router = Object.fromEntries(
    [
      "Link",
      "Navigate",
      "Outlet",
      "BrowserRouter",
      "NavLink",
      "Route",
      "Routes"
    ].map((name) => [name, name])
  );
  router.useNavigate = () => (to, options) =>
    calls.push({ method: "navigate", to, options });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const code = ts.transpileModule(
      fs.readFileSync(filename, "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022
        }
      }
    ).outputText;
    const requireMock = (id) => {
      if (id === "react") return react;
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (id === "react-router-dom") return router;
      if (id.endsWith("/lib/supabase"))
        return { supabase: { auth: api } };
      if (id.endsWith(".css")) return {};
      const base = path.resolve(path.dirname(filename), id);
      return load(
        [base, base + ".ts", base + ".tsx"].find((p) =>
          fs.existsSync(p)
        )
      );
    };
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        require: requireMock,
        window: {
          location: {
            origin: "http://localhost:5173",
            hash: "",
            search: "",
            ...location
          }
        },
        URLSearchParams,
        FormData: class {
          constructor(values) {
            this.values = values;
          }
          get(key) {
            return this.values[key] ?? null;
          }
        }
      },
      { filename }
    );
    cache.set(filename, module.exports);
    return module.exports;
  }
  const component = load(path.join(root, file));
  return {
    api,
    calls,
    states,
    effects,
    exports: component,
    load(file) {
      return load(path.join(root, file));
    },
    render(props = {}) {
      cursor = 0;
      return (component.default ?? component.AuthProvider)({
        children: "child",
        ...props
      });
    }
  };
}
function nodes(tree) {
  if (tree == null || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function form(tree, label) {
  return nodes(tree).find(
    (n) =>
      n.type === "form" &&
      (!label || n.props["aria-label"] === label)
  );
}
function event(values) {
  return {
    currentTarget: values,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    }
  };
}
function textContent(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(textContent).join("");
  if (typeof tree !== "object") return String(tree);
  return textContent(tree.props?.children);
}
function submitButton(tree, label) {
  return nodes(form(tree, label)).find(
    (n) => n.type === "button" && n.props.type === "submit"
  );
}
function confirmationButton(tree) {
  return nodes(tree).find(
    (n) => n.type === "button" && /(?:Resend|Send) confirmation email|Sending…/.test(textContent(n))
  );
}
function assertFormsEnabled(tree, enabled) {
  const fieldsets = nodes(tree).filter((n) => n.type === "fieldset");
  assert.equal(fieldsets.length, 2);
  assert.ok(fieldsets.every((n) => Boolean(n.props.disabled) === !enabled));
}
const signupValues = {
  email: "user@example.com",
  password: "secret1",
  confirmPassword: "secret1"
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function respondWith(h, method, response) {
  h.api[method] = async (input, options) => {
    h.calls.push({ method, input, options });
    return typeof response === "function" ? response(input) : response;
  };
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
(async () => {
  await check(
    "login prevents native submission, trims email, preserves password and unlocks forms",
    async () => {
      const h = harness("pages/LoginPage.tsx");
      const e = event({
        email: " user@example.com ",
        password: " secret "
      });
      await form(h.render(), "Log in").props.onSubmit(e);
      assert.equal(e.prevented, true);
      assert.equal(h.calls[0].method, "signInWithPassword");
      assert.equal(h.calls[0].input.email, "user@example.com");
      assert.equal(h.calls[0].input.password, " secret ");
      assert.ok(
        nodes(h.render())
          .filter((n) => n.type === "fieldset")
          .every((n) => !n.props.disabled)
      );
    }
  );
  await check(
    "login API errors remain visible without redirect",
    async () => {
      const h = harness("pages/LoginPage.tsx");
      h.api.signInWithPassword = async () => ({
        error: { message: "Invalid login credentials" }
      });
      await form(h.render(), "Log in").props.onSubmit(
        event({})
      );
      assert.ok(
        JSON.stringify(h.render()).includes(
          "Invalid login credentials"
        )
      );
    }
  );
  await check(
    "network failure releases loading state",
    async () => {
      const h = harness("pages/LoginPage.tsx");
      h.api.signInWithPassword = async () => {
        throw Error("offline");
      };
      await form(h.render(), "Log in").props.onSubmit(
        event({})
      );
      assert.ok(
        JSON.stringify(h.render()).includes("Unable to log in")
      );
      assertFormsEnabled(h.render(), true);
    }
  );
  await check(
    "signup rejects mismatched passwords without API call",
    async () => {
      const h = harness("pages/LoginPage.tsx");
      await form(h.render(), "Sign up").props.onSubmit(
        event({
          password: "secret1",
          confirmPassword: "secret2"
        })
      );
      assert.equal(h.calls.length, 0);
      assert.ok(
        JSON.stringify(h.render()).includes(
          "Passwords do not match"
        )
      );
    }
  );
  await check(
    "signup requests confirmation with the correct return URL",
    async () => {
      const h = harness("pages/LoginPage.tsx");
      await form(h.render(), "Sign up").props.onSubmit(
        event({
          email: " user@example.com ",
          password: "secret1",
          confirmPassword: "secret1"
        })
      );
      assert.equal(h.calls[0].method, "signUp");
      assert.equal(
        h.calls[0].input.options.emailRedirectTo,
        "http://localhost:5173/login"
      );
      assert.ok(
        JSON.stringify(h.render()).includes("Check your email")
      );
    }
  );
  await check(
    "signed-in login redirects and initial session loading hides forms",
    () => {
      assert.equal(
        harness("pages/LoginPage.tsx", {
          session: {},
          loading: false
        }).render().props.to,
        "/feed"
      );
      assert.equal(
        form(
          harness("pages/LoginPage.tsx", {
            session: null,
            loading: true
          }).render()
        ),
        undefined
      );
    }
  );
  await check(
    "guard blocks anonymous sessions and allows authenticated sessions",
    () => {
      assert.equal(
        harness("components/RequireAuth.tsx").render().props.to,
        "/login"
      );
      assert.equal(
        harness("components/RequireAuth.tsx", {
          session: {},
          loading: false
        }).render().type,
        "Outlet"
      );
      assert.equal(
        harness("components/RequireAuth.tsx", {
          session: null,
          loading: true
        }).render().type,
        "p"
      );
    }
  );
  await check(
    "all account routes are unique and nested under the guard",
    () => {
      const tree = harness("App.tsx").render();
      const routes = nodes(tree).filter(
        (n) => n.type === "Route"
      );
      for (const route of [
        "profile",
        "/feed",
        "/community",
        "/search",
        "/messages",
        "/settings",
        "/share",
        "/browse"
      ]) {
        assert.equal(
          routes.filter((n) => n.props.path === route).length,
          1
        );
        assert.ok(
          routes.some(
            (n) =>
              n.props.element?.type?.name === "RequireAuth" &&
              nodes(n.props.children).some(
                (child) => child.props?.path === route
              )
          )
        );
      }
    }
  );
  await check(
    "provider handles initial session, sign-out and subscription cleanup",
    () => {
      const h = harness("auth/AuthProvider.tsx");
      h.render();
      const cleanup = h.effects[0]();
      h.api.emit("INITIAL_SESSION", {
        user: { email: "user@example.com" }
      });
      assert.equal(h.render().props.value.loading, false);
      assert.equal(
        h.render().props.value.session.user.email,
        "user@example.com"
      );
      h.api.emit("SIGNED_OUT", null);
      assert.equal(h.render().props.value.session, null);
      cleanup();
      assert.equal(h.api.unsubscribed, true);
    }
  );
  await check(
    "recovery sends reset URL and does not disclose account existence",
    async () => {
      const h = harness("pages/ForgotPasswordPage.tsx");
      await form(h.render()).props.onSubmit(
        event({ email: " user@example.com " })
      );
      assert.equal(
        h.calls[0].options.redirectTo,
        "http://localhost:5173/reset-password"
      );
      assert.ok(
        JSON.stringify(h.render()).includes(
          "If an account exists"
        )
      );
    }
  );
  await check(
    "reset requires a session and rejects mismatched passwords",
    async () => {
      assert.equal(
        form(harness("pages/ResetPasswordPage.tsx").render()),
        undefined
      );
      const h = harness("pages/ResetPasswordPage.tsx", {
        session: {},
        loading: false
      });
      await form(h.render()).props.onSubmit(
        event({
          password: "secret1",
          confirmPassword: "secret2"
        })
      );
      assert.equal(h.calls.length, 0);
    }
  );
  await check(
    "reset updates password and renders success",
    async () => {
      const h = harness("pages/ResetPasswordPage.tsx", {
        session: {},
        loading: false
      });
      await form(h.render()).props.onSubmit(
        event({
          password: "secret1",
          confirmPassword: "secret1"
        })
      );
      assert.equal(h.calls[0].method, "updateUser");
      assert.ok(
        JSON.stringify(h.render()).includes("Password updated")
      );
    }
  );
  await check(
    "legacy resend route returns to the conditional login flow",
    async () => {
      const h = harness("pages/ResendConfirmationPage.tsx");
      assert.equal(h.render().type, "Navigate");
      assert.equal(h.render().props.to, "/login");
      assert.equal(form(h.render()), undefined);
    }
  );
  await check(
    "logout navigates only after success and exposes failures",
    async () => {
      const h = harness("components/LogoutButton.tsx");
      await nodes(h.render())
        .find((n) => n.type === "button")
        .props.onClick();
      assert.equal(h.calls[1].to, "/login");
      const failure = harness("components/LogoutButton.tsx");
      failure.api.signOut = async () => ({
        error: { message: "Logout failed" }
      });
      await nodes(failure.render())
        .find((n) => n.type === "button")
        .props.onClick();
      assert.equal(failure.calls.length, 0);
      assert.ok(
        JSON.stringify(failure.render()).includes(
          "Logout failed"
        )
      );
    }
  );
  await check(
    "expired auth link displays actionable error",
    () => {
      const h = harness("pages/LoginPage.tsx", undefined, {
        hash: "#error=access_denied&error_code=otp_expired"
      });
      assert.ok(
        JSON.stringify(h.render()).includes(
          "invalid or expired"
        )
      );
    }
  );
  await check("fresh login hides resend confirmation", () => {
    const tree = harness("pages/LoginPage.tsx").render();
    assert.equal(confirmationButton(tree), undefined);
    assert.equal(nodes(tree).find((n) => n.props?.to === "/resend-confirmation"), undefined);
  });
  for (const [label, method, activeLabel, otherLabel] of [
    ["Sign up", "signUp", "Creating account…", "Log in"],
    ["Log in", "signInWithPassword", "Logging in…", "Sign up"]
  ]) {
    await check(`${label} alone shows loading and blocks competing submissions`, async () => {
      const h = harness("pages/LoginPage.tsx");
      const request = deferred();
      respondWith(h, method, request.promise);
      const initialTree = h.render();
      const pending = form(initialTree, label).props.onSubmit(event(signupValues));
      const loadingTree = h.render();
      assert.equal(textContent(submitButton(loadingTree, label)), activeLabel);
      assert.equal(textContent(submitButton(loadingTree, otherLabel)), otherLabel);
      assertFormsEnabled(loadingTree, false);
      // Reuse stale handlers as well as newly rendered handlers: DOM disabling
      // alone does not prevent two submissions in the same render cycle.
      await form(initialTree, label).props.onSubmit(event(signupValues));
      await form(loadingTree, otherLabel).props.onSubmit(event(signupValues));
      assert.equal(h.calls.length, 1);
      request.resolve({ data: { session: {} }, error: null });
      await pending;
      assert.equal(textContent(submitButton(h.render(), label)), label);
      assertFormsEnabled(h.render(), true);
    });
  }
  for (const code of ["user_already_exists", "email_exists"]) {
    await check(`signup code ${code} displays existing-account message without resend`, async () => {
      const h = harness("pages/LoginPage.tsx");
      respondWith(h, "signUp", {
        data: { user: null, session: null },
        error: { code, message: "Provider duplicate message" }
      });
      await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
      const tree = h.render();
      assert.ok(textContent(tree).includes("An account with this email already exists. Log in instead."));
      assert.equal(confirmationButton(tree), undefined);
      assertFormsEnabled(tree, true);
    });
  }
  await check("sanitized duplicate user displays existing-account message without resend", async () => {
    const h = harness("pages/LoginPage.tsx");
    respondWith(h, "signUp", {
      data: {
        session: null,
        user: {
          email: signupValues.email,
          role: "",
          identities: [],
          // Confirmed invited duplicates retain invitation timestamps.
          invited_at: "2026-10-01T12:00:00Z",
          confirmation_sent_at: "2026-10-14T12:00:00Z"
        }
      },
      error: null
    });
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    assert.ok(textContent(h.render()).includes("An account with this email already exists."));
    assert.equal(confirmationButton(h.render()), undefined);
  });
  await check("ambiguous signup does not claim confirmation was sent or show resend", async () => {
    const h = harness("pages/LoginPage.tsx");
    respondWith(h, "signUp", {
      data: {
        session: null,
        user: { email: signupValues.email, confirmation_sent_at: "2026-10-14T12:00:00Z" }
      },
      error: null
    });
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    const tree = h.render();
    assert.equal(confirmationButton(tree), undefined);
    assert.equal(textContent(tree).includes("Check your email"), false);
    assert.equal(textContent(tree).includes("already exists"), false);
    assert.ok(nodes(tree).some((n) => n.props?.role === "status" && textContent(n)));
  });
  await check("immediate signup authentication does not show confirmation or resend", async () => {
    const h = harness("pages/LoginPage.tsx");
    respondWith(h, "signUp", { data: { user: {}, session: {} }, error: null });
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    assert.equal(confirmationButton(h.render()), undefined);
    assert.equal(textContent(h.render()).includes("Check your email"), false);
    // AuthProvider's session event owns the redirect after authentication.
    assertFormsEnabled(h.render(), true);
  });
  await check("failed signup and password mismatch never enable resend", async () => {
    for (const response of [
      { data: { user: null, session: null }, error: { message: "Signup unavailable" } },
      () => { throw Error("offline"); }
    ]) {
      const h = harness("pages/LoginPage.tsx");
      respondWith(h, "signUp", response);
      await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
      assert.equal(confirmationButton(h.render()), undefined);
      assertFormsEnabled(h.render(), true);
    }
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event({ ...signupValues, confirmPassword: "different" }));
    assert.equal(confirmationButton(h.render()), undefined);
    assert.equal(h.calls.length, 0);
  });
  await check("pending signup resends for submitted email and has independent loading", async () => {
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event({ ...signupValues, email: " user@example.com " }));
    assert.equal(textContent(confirmationButton(h.render())), "Resend confirmation email");
    const request = deferred();
    respondWith(h, "resend", request.promise);
    const initialButton = confirmationButton(h.render());
    const pending = initialButton.props.onClick();
    const tree = h.render();
    assert.equal(textContent(confirmationButton(tree)), "Sending…");
    assert.equal(confirmationButton(tree).props.disabled, true);
    assert.equal(textContent(submitButton(tree, "Log in")), "Log in");
    assert.equal(textContent(submitButton(tree, "Sign up")), "Sign up");
    assertFormsEnabled(tree, false);
    await initialButton.props.onClick();
    const resendCalls = h.calls.filter((call) => call.method === "resend");
    assert.equal(resendCalls.length, 1);
    assert.equal(resendCalls[0].input.type, "signup");
    assert.equal(resendCalls[0].input.email, "user@example.com");
    assert.equal(resendCalls[0].input.options.emailRedirectTo, "http://localhost:5173/login");
    request.resolve({ error: null });
    await pending;
    assert.equal(textContent(confirmationButton(h.render())), "Resend confirmation email");
    assertFormsEnabled(h.render(), true);
    assert.ok(/confirmation.*(sent|requested)|check your email/i.test(textContent(h.render())));
  });
  await check("resend error remains actionable and releases loading", async () => {
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    respondWith(h, "resend", { error: { code: "over_email_send_rate_limit", message: "Rate limit" } });
    await confirmationButton(h.render()).props.onClick();
    assert.ok(textContent(h.render()).includes("Please wait before requesting another email."));
    assert.equal(confirmationButton(h.render()).props.disabled, false);
    assertFormsEnabled(h.render(), true);
    respondWith(h, "resend", () => { throw Error("offline"); });
    await confirmationButton(h.render()).props.onClick();
    assert.ok(textContent(h.render()).includes("Unable to send a confirmation link"));
    assertFormsEnabled(h.render(), true);
  });
  await check("editing signup email clears stale confirmation and notice", async () => {
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    const email = nodes(form(h.render(), "Sign up")).find((n) => n.type === "input" && n.props.name === "email");
    email.props.onChange({ currentTarget: { value: "different@example.com" }, target: { value: "different@example.com" } });
    assert.equal(confirmationButton(h.render()), undefined);
    assert.equal(textContent(h.render()).includes("Check your email"), false);
  });
  await check("a new failed or duplicate signup clears earlier confirmation state", async () => {
    for (const response of [
      { data: { session: null }, error: { code: "email_exists", message: "Duplicate" } },
      { data: { session: null }, error: { message: "Signup unavailable" } }
    ]) {
      const h = harness("pages/LoginPage.tsx");
      await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
      assert.ok(confirmationButton(h.render()));
      respondWith(h, "signUp", response);
      await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
      assert.equal(confirmationButton(h.render()), undefined);
      assert.equal(textContent(h.render()).includes("Check your email"), false);
    }
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    await form(h.render(), "Sign up").props.onSubmit(event({ ...signupValues, confirmPassword: "different" }));
    assert.equal(confirmationButton(h.render()), undefined);
    assert.ok(textContent(h.render()).includes("Passwords do not match"));
  });
  await check("editing the other form leaves resend bound to its original submitted email", async () => {
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    const loginEmail = nodes(form(h.render(), "Log in")).find((n) => n.type === "input" && n.props.name === "email");
    loginEmail.props.onChange({ currentTarget: { value: "different@example.com" }, target: { value: "different@example.com" } });
    await confirmationButton(h.render()).props.onClick();
    assert.equal(h.calls.find((call) => call.method === "resend").input.email, signupValues.email);
  });
  await check("unconfirmed signin offers Send, promotes to Resend only after success, and clears on email edit", async () => {
    const h = harness("pages/LoginPage.tsx");
    respondWith(h, "signInWithPassword", {
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" }
    });
    await form(h.render(), "Log in").props.onSubmit(event({ email: " waiting@example.com ", password: "secret1" }));
    assert.equal(textContent(confirmationButton(h.render())), "Send confirmation email");
    assert.equal(textContent(h.render()).includes("Resend confirmation email"), false);
    respondWith(h, "resend", { error: { code: "over_email_send_rate_limit", message: "Rate limit" } });
    await confirmationButton(h.render()).props.onClick();
    assert.equal(textContent(confirmationButton(h.render())), "Send confirmation email");
    assert.equal(textContent(h.render()).includes("Resend confirmation email"), false);
    assert.ok(textContent(h.render()).includes("Please wait before requesting another email."));
    assertFormsEnabled(h.render(), true);
    const request = deferred();
    respondWith(h, "resend", request.promise);
    const pending = confirmationButton(h.render()).props.onClick();
    assert.equal(textContent(confirmationButton(h.render())), "Sending…");
    assert.equal(confirmationButton(h.render()).props.disabled, true);
    assertFormsEnabled(h.render(), false);
    request.resolve({ error: null });
    await pending;
    assert.equal(textContent(confirmationButton(h.render())), "Resend confirmation email");
    assertFormsEnabled(h.render(), true);
    respondWith(h, "resend", { error: null });
    await confirmationButton(h.render()).props.onClick();
    const confirmationCalls = h.calls.filter((call) => call.method === "resend");
    assert.equal(confirmationCalls.length, 3);
    assert.ok(confirmationCalls.every((call) => call.input.email === "waiting@example.com"));
    const email = nodes(form(h.render(), "Log in")).find((n) => n.type === "input" && n.props.name === "email");
    email.props.onChange({ currentTarget: { value: "different@example.com" }, target: { value: "different@example.com" } });
    assert.equal(confirmationButton(h.render()), undefined);
  });
  await check("authenticated signin clears a previous signup confirmation", async () => {
    const h = harness("pages/LoginPage.tsx");
    await form(h.render(), "Sign up").props.onSubmit(event(signupValues));
    assert.ok(confirmationButton(h.render()));
    await form(h.render(), "Log in").props.onSubmit(event(signupValues));
    assert.equal(confirmationButton(h.render()), undefined);
  });
  await check("workflow accepts an auth service without depending on Supabase responses", async () => {
    const h = harness("pages/LoginPage.tsx");
    const calls = [];
    const authService = {
      async signIn() { return { status: "authenticated" }; },
      async signUp(credentials) {
        calls.push(credentials);
        return { status: "account-exists" };
      },
      async resendConfirmation() { return { status: "sent" }; }
    };
    await form(h.render({ authService }), "Sign up").props.onSubmit(event(signupValues));
    assert.equal(calls.length, 1);
    assert.equal(h.calls.length, 0);
    assert.ok(textContent(h.render({ authService })).includes("An account with this email already exists."));
  });
  await check("adapter distinguishes confirmation, invitations, duplicates and unfamiliar responses", async () => {
    const h = harness("auth/supabaseAuthService.ts");
    const service = h.exports.createSupabaseAuthService({ auth: h.api }, () => "https://example.com/login");
    const pendingUser = {
      email: signupValues.email,
      role: "authenticated",
      identities: [{ provider: "email" }],
      confirmation_sent_at: "2026-10-14T12:00:00Z"
    };
    const cases = [
      [pendingUser, "confirmation-required", "normal email account"],
      [{ ...pendingUser, identities: [], invited_at: "2026-10-01T12:00:00Z" }, "confirmation-required", "pending invitation"],
      [{ ...pendingUser, identities: [], role: "" }, "account-exists", "sanitized duplicate"],
      [{ ...pendingUser, identities: [], role: "", invited_at: "2026-10-01T12:00:00Z" }, "account-exists", "invited duplicate"],
      [{ ...pendingUser, identities: undefined }, "unknown", "omitted identities"],
      [{ ...pendingUser, identities: [] }, "unknown", "empty identities without invitation"],
      [{ ...pendingUser, confirmation_sent_at: undefined }, "unknown", "no accepted confirmation request"],
      [{ ...pendingUser, email_confirmed_at: "2026-10-01T12:00:00Z" }, "unknown", "confirmed email without session"],
      [{ ...pendingUser, confirmed_at: "2026-10-01T12:00:00Z" }, "unknown", "confirmed user without session"],
      [{ ...pendingUser, identities: [{ provider: "google" }] }, "unknown", "unrelated provider"],
      [{ ...pendingUser, email: "" }, "unknown", "missing email"],
      [null, "unknown", "missing user"]
    ];
    for (const [user, expected, description] of cases) {
      respondWith(h, "signUp", { data: { user, session: null }, error: null });
      const result = await service.signUp({ email: " user@example.com ", password: " secret " });
      assert.equal(result.status, expected, description);
      if (expected === "confirmation-required") assert.equal(result.email, "user@example.com");
    }
    assert.equal(h.calls[0].input.password, " secret ");
    assert.equal(h.calls[0].input.options.emailRedirectTo, "https://example.com/login");
  });
  await check("adapter gives provider errors priority over signup data", async () => {
    const h = harness("auth/supabaseAuthService.ts");
    const service = h.exports.createSupabaseAuthService({ auth: h.api }, () => "https://example.com/login");
    for (const [code, expected] of [
      ["user_already_exists", "account-exists"],
      ["email_exists", "account-exists"],
      ["over_email_send_rate_limit", "error"]
    ]) {
      respondWith(h, "signUp", { data: { session: {} }, error: { code, message: "Provider message" } });
      assert.equal((await service.signUp(signupValues)).status, expected);
    }
    respondWith(h, "signUp", { data: { session: {} }, error: null });
    assert.equal((await service.signUp(signupValues)).status, "authenticated");
  });
  await check("adapter maps signin and resend errors and rejects missing signin sessions", async () => {
    const h = harness("auth/supabaseAuthService.ts");
    const service = h.exports.createSupabaseAuthService({ auth: h.api }, () => "https://example.com/login");
    respondWith(h, "signInWithPassword", { data: { session: null }, error: null });
    assert.equal((await service.signIn(signupValues)).status, "error");
    respondWith(h, "signInWithPassword", { data: { session: null }, error: { code: "invalid_credentials", message: "Provider text" } });
    assert.equal((await service.signIn(signupValues)).message, "Incorrect email or password.");
    respondWith(h, "resend", { error: { status: 429, message: "Provider text" } });
    assert.equal((await service.resendConfirmation(signupValues.email)).message, "Too many attempts. Please wait and try again.");
    respondWith(h, "resend", { error: { code: "email_already_confirmed", message: "Provider text" } });
    assert.equal((await service.resendConfirmation(signupValues.email)).message, "This email is already confirmed. Log in instead.");
  });
  console.log(
    `${passed} auth smoke checks passed (mocked SDK and React hooks; no live accounts).`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
