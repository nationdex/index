import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  catalogue,
  repository,
  instanceOrigin,
  metadata,
  installed,
  requestJSON,
} from "../assets/index.js";
const sha = "a".repeat(40);
const entry = {
  id: "example",
  repo: "https://github.com/nationdex/extra",
  ref: sha,
};
test("repository parsing rejects deceptive hosts, URL credentials and extra path segments", () => {
  for (const url of [
    "https://github.com.evil.test/a/b",
    "https://evil.test/github.com/a/b",
    "http://github.com/a/b",
    "https://user@github.com/a/b",
    "https://github.com/a/b?x=1",
    "https://github.com/a/b/tree/main",
    "javascript:alert(1)",
    "https://github.com/a/%62",
  ])
    assert.throws(() => repository(url));
  assert.equal(repository(entry.repo + ".git").url, entry.repo);
});
test("catalogue is bounded, unique, pinned and typed", () => {
  assert.equal(catalogue({ extras: [entry] })[0].ref, sha);
  for (const extras of [
    [entry, entry],
    [{ ...entry, ref: "main" }],
    [{ ...entry, id: "<img>" }],
    [{ ...entry, branch: "../secret" }],
    Array(101).fill(entry),
  ])
    assert.throws(() => catalogue({ extras }));
});
test("instance URLs cannot smuggle credentials, paths or insecure protocols", () => {
  for (const value of [
    "http://dex.example",
    "https://user:pass@dex.example",
    "https://dex.example/path",
    "https://dex.example/?token=1",
    "https://dex.example/#x",
  ])
    assert.throws(() => instanceOrigin(value));
  assert.equal(instanceOrigin("https://dex.example:8443"), "https://dex.example:8443");
});
test("metadata types and text lengths are bounded and links reject active schemes", () => {
  const item = catalogue({ extras: [entry] })[0];
  const result = metadata(
    {
      name: {},
      description: "x".repeat(4000),
      homepage: "javascript:alert(1)",
      authors: [{ name: {} }],
    },
    item,
  );
  assert.equal(result.name, "example");
  assert.equal(result.description.length, 2000);
  assert.equal(result.homepage, "");
  assert.equal(result.authors, "");
  assert.equal(metadata({ homepage: "https://user:pass@evil.test" }, item).homepage, "");
});
test("installed extras cannot supply arbitrary operation data", () => {
  assert.deepEqual(installed({ extras: [{ id: "example", ref: sha }] }), [
    { id: "example", ref: sha, enabled: true },
  ]);
  for (const extras of [
    [{ id: "../x", ref: sha }],
    [{ id: "x", ref: "main" }],
    [{ id: "x", ref: sha, enabled: "false" }],
  ])
    assert.throws(() => installed({ extras }));
});
test("JSON fetch rejects oversized bodies, unexpected content types and redirects", async () => {
  const server = await import("node:http").then(({ createServer }) =>
    new Promise(resolve => {
      const server = createServer(async (req, res) => {
        const p = new URL(req.url, "http://localhost").pathname;
        if (p === "/redirect") { res.writeHead(302, { Location: "/large" }).end(); return; }
        if (p === "/html") { res.writeHead(200, { "Content-Type": "text/html" }).end("<html>"); return; }
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ text: "x".repeat(500) }));
      });
      server.listen(0, "127.0.0.1", () => resolve(server));
    })
  );
  try {
    for (const p of ["large", "html", "redirect"])
      await assert.rejects(requestJSON(`http://127.0.0.1:${server.address().port}/${p}`, { limit: 64 }));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
test("page CSP authorizes only the exact module hash and no inline evaluation", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const source = await readFile(new URL("../assets/index.js", import.meta.url));
  const hash =
    "sha256-" + (await import("node:crypto")).createHash("sha256").update(source).digest("base64");
  assert.ok(html.includes("script-src '" + hash + "'"));
  assert.ok(html.includes('integrity="' + hash + '"'));
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|<script(?![^>]*src=)/);
  assert.doesNotMatch(source.toString(), /innerHTML|insertAdjacentHTML|document\.write|\beval\s*\(/);
});
