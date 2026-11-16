import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("navigation links and active states follow the current route", async () => {
  const server = await createServer({
    configFile: false,
    envDir: false,
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://example.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-key")
    },
    server: { middlewareMode: true }
  });

  try {
    const { default: SiteLayout } = await server.ssrLoadModule(
      "/src/components/SiteLayout.tsx"
    );
    const { default: DashboardLayout } = await server.ssrLoadModule(
      "/src/components/DashboardLayout.tsx"
    );
    const { AuthContext } = await server.ssrLoadModule("/src/auth/useAuth.ts");

    function render(component, path, session = null) {
      return renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            AuthContext.Provider,
            { value: { session, loading: false, mfaStatus: "satisfied" } },
            createElement(component)
          )
        )
      );
    }

    function links(markup) {
      return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(
        ([, attributes, content]) => ({
          href: attributes.match(/href="([^"]+)"/)?.[1],
          active: attributes.includes('aria-current="page"'),
          className: attributes.match(/class="([^"]*)"/)?.[1] ?? "",
          marker: content.includes('class="active-marker"'),
          text: content.replace(/<[^>]*>/g, "").trim()
        })
      );
    }

    const landing = links(render(SiteLayout, "/"));
    for (const [label, href] of [
      ["Home", "/"],
      ["Community", "/community"],
      ["Search", "/search"],
      ["Messages", "/messages"],
      ["Settings", "/settings"]
    ]) {
      const matches = landing.filter((link) => link.text === label);
      assert.equal(matches.length, 2, `${label} appears in desktop and mobile navigation`);
      for (const link of matches) {
        assert.equal(link.href, href);
        assert.equal(link.active, href === "/");
      }
    }

    for (const path of ["/info", "/profile", "/profile/example"]) {
      const header = links(render(SiteLayout, path));
      for (const [label, href] of [
        ["Home", "/"],
        ["Feed", "/feed"],
        ["Info", "/info"],
        ["Profile", "/profile"]
      ]) {
        const link = header.find((item) => item.text === label);
        assert.ok(link, `${label} header link exists`);
        assert.equal(link.href, href);
        assert.equal(link.active, path === href || path.startsWith(`${href}/`));
      }
    }

    const login = links(render(SiteLayout, "/login")).find(
      (link) => link.text === "Log in"
    );
    assert.ok(login);
    assert.equal(login.href, "/login");
    assert.ok(login.className.split(" ").includes("active"));

    const messages = links(render(SiteLayout, "/messages", {})).find(
      (link) => link.text === "Messages"
    );
    assert.ok(messages);
    assert.equal(messages.href, "/messages");
    assert.ok(messages.className.split(" ").includes("active"));

    for (const [label, href] of [
      ["Feed", "/feed"],
      ["Community", "/community"],
      ["Search", "/search"],
      ["Messages", "/messages"],
      ["Settings", "/settings"]
    ]) {
      for (const path of [href, `${href}/nested`]) {
        const dashboard = links(render(DashboardLayout, path));
        for (const item of dashboard.filter((link) =>
          ["Feed", "Community", "Search", "Messages", "Settings"].includes(link.text)
        )) {
          assert.equal(item.active, item.text === label);
          assert.equal(item.marker, item.active);
        }
        assert.equal(dashboard.find((item) => item.text === label)?.href, href);
      }
    }
  } finally {
    await server.close();
  }
});
