import test from "node:test";
import assert from "node:assert/strict";
import type { GeneratedProject } from "../lib/project/types";
import type { VerveProjectSpec } from "../lib/domain/project-spec";
import { nativePreviewPages, resolveNativePreviewLink, isNativeNavigationMessage, nativeNavigationBridge } from "../lib/project/html-preview-navigation";
import { buildHtmlPreviewDocument } from "../lib/project/html-preview";
import { createVisualTruthMatrix, privacySafeSurfaceKey } from "../lib/project/visual-truth";

const project = {
  framework: "html", entryFile: "index.html", files: [
    { path: "index.html", content: "<html><head><title>Home</title></head><body>Home</body></html>" },
    { path: "work/index.html", content: "<html><head><title>Work</title></head><body>Work</body></html>" },
    { path: "about.html", content: "<h1>About</h1>" },
    { path: "app.js", content: "" },
    { path: "assets/hidden.html", content: "binary", encoding: "base64" },
  ],
} as GeneratedProject;

test("preview pages come from delivered HTML and retain exact planned route identities", () => {
  const spec = { experience: { routes: [{ id: "home", path: "/" }, { id: "portfolio", path: "/work" }] } } as VerveProjectSpec;
  const pages = nativePreviewPages(project, spec);
  assert.deepEqual(pages, [
    { file: "index.html", routePath: "/", routeId: "home" },
    { file: "about.html", routePath: "/about", routeId: "html:about.html" },
    { file: "work/index.html", routePath: "/work", routeId: "portfolio" },
  ]);
  assert.deepEqual(nativePreviewPages({ ...project, files: [...project.files].reverse() }, spec), pages, "Manifest ordering does not change route identity");
  const fallback = createVisualTruthMatrix(undefined, pages.map((page) => page.routeId));
  assert.equal(fallback.expectedRoutes, 3);
  assert.equal(fallback.expectedStateViewports, 9);
  assert.equal(fallback.contract.routes[0].routeKey, privacySafeSurfaceKey("home"));
  assert.deepEqual(nativePreviewPages({ ...project, framework: "nextjs" }), []);
  const aliasCollision = nativePreviewPages({ ...project, files: [...project.files, { path: "work.html", content: "Work alias", role: "source", language: "html" }] }, spec);
  assert.equal(new Set(aliasCollision.map((page) => page.routeId)).size, aliasCollision.length, "Two delivered files sharing a route alias still require independent evidence");
  assert.equal(resolveNativePreviewLink(aliasCollision, "index.html", "/work/index.html")?.file, "work/index.html", "Exact paths win over alias candidates");
});

test("native links resolve relative/nested/root/directory paths, query and fragments without server fallback", () => {
  const pages = nativePreviewPages(project);
  for (const href of ["../about.html", "/about", "/about.html", "../about%2Ehtml"]) {
    assert.deepEqual(resolveNativePreviewLink(pages, "work/index.html", href), { file: "about.html", query: "", fragment: "" });
  }
  for (const href of ["/", "../", "../index.html"]) assert.equal(resolveNativePreviewLink(pages, "work/index.html", href)?.file, "index.html");
  for (const href of ["work/", "work", "./work/index.html"]) assert.equal(resolveNativePreviewLink(pages, "index.html", href)?.file, "work/index.html");
  assert.deepEqual(resolveNativePreviewLink(pages, "index.html", "./work/?v=1#details"), { file: "work/index.html", query: "?v=1", fragment: "#details" });
  assert.equal(resolveNativePreviewLink(pages, "work/index.html", "#details")?.file, "work/index.html");
  for (const href of ["https://example.com", "//example.com", "javascript:alert(1)", "data:text/html,hello", "mailto:x@y.com", "../../about.html", "../%2e%2e/about.html", "/missing", "./app.js", "bad\u0000path", "a".repeat(2049)]) {
    assert.equal(resolveNativePreviewLink(pages, "index.html", href), null, href);
  }
});

test("navigation messages require the active probe and bounded fields; absent pages never render the entry instead", () => {
  const message = { source: "verve-native-navigation", version: 1, probeId: "active", href: "/work" };
  assert.equal(isNativeNavigationMessage(message, "active"), true);
  for (const changed of [{ ...message, probeId: "old" }, { ...message, version: 2 }, { ...message, href: 2 }, { ...message, href: "a".repeat(2049) }, null]) {
    assert.equal(isNativeNavigationMessage(changed, "active"), false);
  }
  assert.throws(() => buildHtmlPreviewDocument(project, "active", undefined, { entryFile: "missing.html" }), /not delivered/);
  const isolated = buildHtmlPreviewDocument(project, "active", undefined, { entryFile: "work/index.html", routeId: "portfolio", navigation: { fragment: "#details" } });
  assert.match(isolated, /verve-native-navigation/);
  assert.match(isolated, /"routeId":"portfolio"/);
  assert.match(isolated, /<title>Work<\/title>/);
  assert.doesNotMatch(buildHtmlPreviewDocument(project, "active"), /data-verve-native-navigation/);
  assert.doesNotMatch(JSON.stringify(project), /verve-native-navigation|verve-render-gate/);
  assert.match(nativeNavigationBridge("active"), /event.defaultPrevented/);
});
