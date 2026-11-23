export default async function browserAudit(page) {
  const base = "http://127.0.0.1:8765";
  const sha = "a".repeat(40),
    token = "ndx_" + "b".repeat(64);
  const evil =
    '<img src=x onerror="window.__injected=1"><svg onload="window.__injected=1">';
  const checks = [],
    requests = [],
    errors = [];
  const assert = (value, label) => {
    if (!value) throw new Error(label);
    checks.push(label);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/extras.json", (route) =>
    route.fulfill({
      json: {
        extras: [
          {
            id: "example",
            repo: "https://github.com/nationdex/extra",
            ref: sha,
          },
        ],
      },
    }),
  );
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.fulfill({
      json: {
        name: evil,
        description: evil,
        homepage: "javascript:alert(1)",
        version: "1.0.0",
        author: { name: evil },
      },
    }),
  );
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
  let items = [];
  let releaseFirst;
  const firstWait = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  await page.route("https://*.dex.test/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    requests.push({
      host: url.host,
      path: url.pathname,
      method: request.method(),
      auth: request.headers().authorization,
      body: request.postData(),
    });
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.host === "first.dex.test") await firstWait;
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData());
      items = url.pathname.endsWith("/install")
        ? [{ id: body.id, ref: body.ref, enabled: true }]
        : items.map((item) => ({ ...item, enabled: false }));
    }
    const json =
      url.pathname === "/v1/discovery"
        ? { product: "Project Nationdex 2026", protocol: { extras: 1 } }
        : url.pathname === "/v1/extras"
          ? { extras: items }
          : { status: 200, restartRequired: true };
    try {
      await route.fulfill({ headers, json });
    } catch {
      /* aborted first connection */
    }
  });
  await page.clock.install();
  await page.goto(base);
  await page.getByRole("heading", { name: evil, exact: true }).waitFor();
  assert(
    (await page
      .locator("#extras-list img, #extras-list svg, #extras-list [onerror]")
      .count()) === 0,
    "hostile package fields render as text",
  );
  assert(
    (await page.locator('a[href^="javascript:"]').count()) === 0,
    "active homepage schemes rejected",
  );
  assert(
    await page.evaluate(() => window.__injected === undefined),
    "metadata did not execute",
  );
  assert(
    await page.evaluate(() => {
      try {
        document.createElement("div").innerHTML = "<img>";
        return false;
      } catch {
        return true;
      }
    }),
    "Trusted Types blocks HTML string sinks",
  );
  const cspBlocked = await page.evaluate(async () => {
    const inline = document.createElement("script");
    try {
      inline.textContent = "window.__cspExecuted = true";
    } catch {
      return true;
    }
    document.head.append(inline);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return window.__cspExecuted !== true;
  });
  assert(cspBlocked, "Trusted Types/CSP blocks injected script execution");
  await page.getByRole("tab", { name: "Example", exact: true }).click();
  await page
    .locator("#code-example-prefix")
    .filter({ hasText: "BaseCommand" })
    .waitFor();
  assert(
    await page.locator("#example").isVisible(),
    "example tab and source load",
  );
  await page.getByRole("tab", { name: "Submit", exact: true }).click();
  assert(await page.locator("#submit").isVisible(), "submit tab works");
  await page.getByRole("tab", { name: "Extras", exact: true }).click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  assert(
    (await page.locator("html").getAttribute("data-theme")) !== theme,
    "native theme toggle works",
  );
  await page.locator("#instance-url").fill("https://first.dex.test");
  await page.locator("#instance-token").fill(token);
  await page.locator("#connect-button").click();
  await page.waitForFunction(() =>
    document.querySelector("#instance-status").textContent.includes("Checking"),
  );
  await page.locator("#instance-disconnect").click();
  releaseFirst();
  await page.locator("#instance-url").fill("https://second.dex.test");
  await page.locator("#instance-token").fill(token);
  await page.locator("#connect-button").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#instance-status").textContent ===
      "Connected to https://second.dex.test.",
  );
  assert(
    !requests.some((r) => r.host === "first.dex.test" && r.auth),
    "cancelled discovery never receives a token",
  );
  assert(
    !requests.some((r) => r.path === "/v1/discovery" && r.auth),
    "discovery is credential free",
  );
  assert(
    (await page.locator("#instance-token").inputValue()) === "",
    "credential input cleared",
  );
  assert(
    !requests.some((r) => r.method === "POST"),
    "connecting never installs automatically",
  );
  await page.evaluate(() => {
    window.__confirmMessages = [];
    window.confirm = (message) => {
      window.__confirmMessages.push(message);
      return false;
    };
  });
  await page.getByRole("button", { name: "Install on instance" }).click();
  assert(
    !requests.some((r) => r.method === "POST"),
    "cancelled confirmation sends no mutation",
  );
  await page.evaluate(() => {
    window.confirm = (message) => {
      window.__confirmMessages.push(message);
      return true;
    };
  });
  await page.getByRole("button", { name: "Install on instance" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#instance-status")
      .textContent.startsWith("Extras updated"),
  );
  const post = requests.find((r) => r.method === "POST");
  assert(
    post?.host === "second.dex.test" &&
      post?.path === "/v1/extras/install" &&
      JSON.parse(post.body).ref === sha,
    "confirmed install uses selected origin and pinned SHA",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByText("example · " + sha.slice(0, 12) + " · removal pending", {
      exact: true,
    })
    .waitFor();
  assert(
    requests.some((r) => r.method === "POST" && r.path === "/v1/extras/remove"),
    "confirmed removal uses fixed extras endpoint",
  );
  assert(
    await page.evaluate(
      (t) =>
        !JSON.stringify({ ...localStorage }).includes(t) &&
        !JSON.stringify({ ...sessionStorage }).includes(t) &&
        !document.cookie.includes(t),
      token,
    ),
    "token absent from browser storage and cookies",
  );
  await page.clock.fastForward(15 * 60_000 + 1);
  assert(
    (await page.locator("#instance-status").textContent()).includes(
      "15 minutes",
    ),
    "idle expiry disconnects credentials",
  );
  await page.locator("#instance-disconnect").click();
  assert(
    (await page
      .getByRole("button", { name: "Install on instance" })
      .count()) === 0,
    "disconnect removes privileged controls",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile layout has no horizontal overflow",
  );
  await page.route("**/frame-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<iframe src="/"></iframe>',
    }),
  );
  await page.goto(base + "/frame-test");
  const frame = page.frameLocator("iframe");
  await frame
    .locator("#boot-status")
    .filter({ hasText: "Open extras.nationdex.com directly" })
    .waitFor();
  assert(await frame.locator("#app").isHidden(), "framed manager fails closed");
  assert(errors.length === 0, "no uncaught JavaScript errors");
  return { checks, requestCount: requests.length, errors };
}
