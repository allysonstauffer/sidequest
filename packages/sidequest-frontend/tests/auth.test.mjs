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
      return { data: { session: null }, error: null };
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
          states[slot] = value;
        }
      ];
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
    render() {
      cursor = 0;
      return (component.default ?? component.AuthProvider)({
        children: "child"
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
      assert.equal(h.states[2], false);
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
    "resend confirmation uses signup type and login return URL",
    async () => {
      const h = harness("pages/ResendConfirmationPage.tsx");
      await form(h.render()).props.onSubmit(
        event({ email: "user@example.com" })
      );
      assert.equal(h.calls[0].input.type, "signup");
      assert.equal(
        h.calls[0].input.options.emailRedirectTo,
        "http://localhost:5173/login"
      );
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
  console.log(
    `${passed} auth smoke checks passed (mocked SDK and React hooks; no live accounts).`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
