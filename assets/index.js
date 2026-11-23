const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA = /^[a-f0-9]{40}$/;
const REPO_PART = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$/;
const TOKEN = /^ndx_[A-Za-z0-9_-]{32,252}$/;
const MAX_CATALOGUE = 100;
const IDLE_MS = 15 * 60_000;

export function repository(value) {
  if (typeof value !== "string" || value.length > 255)
    throw new Error("Invalid GitHub repository.");
  const url = new URL(value);
  const parts = url.pathname.replace(/\.git$/, "").split("/");
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    parts.length !== 3 ||
    !parts.slice(1).every((part) => REPO_PART.test(part))
  )
    throw new Error("Expected https://github.com/owner/repository.");
  return {
    owner: parts[1],
    repo: parts[2],
    url: "https://github.com/" + parts.slice(1).join("/"),
  };
}
export function instanceOrigin(value) {
  if (typeof value !== "string" || value.length > 255)
    throw new Error("Invalid instance address.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Enter an HTTPS origin, such as https://dex.example.com.");
  return url.origin;
}
export function extraPath(value = "") {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    (value !== "" &&
      !value
        .split("/")
        .every((part) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(part)))
  )
    throw new Error("Invalid extra path.");
  return value;
}
export function catalogue(data) {
  if (
    !data ||
    !Array.isArray(data.extras) ||
    data.extras.length > MAX_CATALOGUE
  )
    throw new Error("Invalid extras catalogue.");
  const seen = new Set();
  return data.extras.map((entry) => {
    if (
      !entry ||
      !ID.test(entry.id) ||
      typeof entry.id !== "string" ||
      seen.has(entry.id)
    )
      throw new Error("Invalid or duplicate extra id.");
    seen.add(entry.id);
    const repo = repository(entry.repo);
    const branch = entry.branch ?? "main";
    if (
      typeof branch !== "string" ||
      branch.length > 200 ||
      !branch
        .split("/")
        .every(
          (part) =>
            /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== "..",
        )
    )
      throw new Error("Invalid catalogue branch.");
    if (
      entry.ref !== undefined &&
      (typeof entry.ref !== "string" || !SHA.test(entry.ref))
    )
      throw new Error("Invalid catalogue commit.");
    return {
      id: entry.id,
      repository: repo,
      branch,
      ref: entry.ref ?? null,
      path: extraPath(entry.path),
    };
  });
}
function text(value, limit, fallback = "") {
  return typeof value === "string" ? value.slice(0, limit) : fallback;
}
export function metadata(data, entry) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid package metadata.");
  const authors = Array.isArray(data.authors)
    ? data.authors.slice(0, 10)
    : [data.author];
  let homepage = "";
  if (typeof data.homepage === "string" && data.homepage.length <= 2048) {
    try {
      const url = new URL(data.homepage);
      if (url.protocol === "https:" && !url.username && !url.password)
        homepage = url.href;
    } catch {
      /* optional link */
    }
  }
  return {
    ...entry,
    name: text(data.name, 120, entry.id),
    version: text(data.version, 80),
    description: text(data.description, 2000, "No description provided."),
    authors: authors
      .map((a) => text(typeof a === "string" ? a : a?.name, 100))
      .filter(Boolean)
      .join(", "),
    license: text(
      typeof data.license === "string" ? data.license : data.license?.type,
      100,
    ),
    homepage,
  };
}
export function unpackedSize(data, path = "") {
  const prefix = extraPath(path);
  if (
    !data ||
    data.truncated !== false ||
    !Array.isArray(data.tree) ||
    data.tree.length > 10000
  )
    throw new Error("Incomplete GitHub file tree.");
  let bytes = 0;
  let found = prefix === "";
  for (const item of data.tree) {
    if (
      prefix &&
      (typeof item?.path !== "string" || !item.path.startsWith(prefix + "/"))
    )
      continue;
    found = true;
    if (item?.type === "tree") continue;
    if (
      item?.type !== "blob" ||
      !["100644", "100755"].includes(item.mode) ||
      !Number.isSafeInteger(item.size) ||
      item.size < 0
    )
      throw new Error("Invalid GitHub file tree.");
    bytes += item.size;
    if (!Number.isSafeInteger(bytes)) throw new Error("Invalid file size.");
  }
  if (!found) throw new Error("Extra folder is absent from the tree.");
  return bytes;
}
function sizeLabel(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MiB";
}
async function estimateSize(entry) {
  if (!entry.ref) return null;
  const base =
    "https://api.github.com/repos/" +
    entry.repository.owner +
    "/" +
    entry.repository.repo;
  const commit = await requestJSON(base + "/git/commits/" + entry.ref, {
    limit: 1048576,
  });
  if (
    commit?.sha !== entry.ref ||
    typeof commit?.tree?.sha !== "string" ||
    !SHA.test(commit.tree.sha)
  )
    throw new Error("Invalid GitHub commit response.");
  const tree = await requestJSON(
    base + "/git/trees/" + commit.tree.sha + "?recursive=1",
    { limit: 1048576 },
  );
  if (tree?.sha !== commit.tree.sha)
    throw new Error("Invalid GitHub tree response.");
  return unpackedSize(tree, entry.path);
}
export function installed(data) {
  if (
    !data ||
    !Array.isArray(data.extras) ||
    data.extras.length > MAX_CATALOGUE
  )
    throw new Error("Invalid installed extras response.");
  const seen = new Set();
  return data.extras.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID.test(item.id) ||
      seen.has(item.id) ||
      typeof item.ref !== "string" ||
      !SHA.test(item.ref) ||
      (item.enabled !== undefined && typeof item.enabled !== "boolean")
    )
      throw new Error("Invalid installed extra.");
    seen.add(item.id);
    return { id: item.id, ref: item.ref, enabled: item.enabled !== false };
  });
}
export async function requestJSON(
  url,
  {
    signal,
    method = "GET",
    token,
    body,
    limit = 131072,
    timeout = 10000,
    allowPlainText = false,
  } = {},
) {
  const response = await fetch(url, {
    method,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout),
    mode: "cors",
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Request failed (HTTP " + response.status + ").");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (
    !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(contentType) &&
    !(allowPlainText && /^text\/plain(?:\s*;|$)/i.test(contentType))
  ) {
    await response.body?.cancel();
    throw new Error("Expected a JSON response.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty response.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Response exceeds the size limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function start() {
  const $ = (id) => document.getElementById(id);
  // GitHub Pages cannot set frame-ancestors headers. Fail closed before exposing the form.
  if (window.self !== window.top) {
    $("boot-status").textContent =
      "Open extras.nationdex.com directly to manage your instance.";
    return;
  }
  $("boot-status").hidden = true;
  $("app").hidden = false;
  const node = (tag, value, className) => {
    const n = document.createElement(tag);
    if (value !== undefined) n.textContent = value;
    if (className) n.className = className;
    return n;
  };
  const status = (value) => {
    $("instance-status").textContent = value;
  };
  let extras = [],
    active = null,
    pending = null,
    generation = 0,
    busy = false,
    idleTimer;
  const reset = (message = "Disconnected.") => {
    generation++;
    pending?.abort();
    pending = null;
    active?.controller.abort();
    if (active) active.token = "";
    active = null;
    busy = false;
    clearTimeout(idleTimer);
    $("instance-token").value = "";
    $("connect-button").disabled = false;
    $("instance-installed").replaceChildren();
    renderActions();
    status(message);
  };
  const touch = () => {
    if (active) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => reset("Disconnected after 15 minutes without activity."),
        IDLE_MS,
      );
    }
  };
  for (const event of ["pointerdown", "keydown"])
    document.addEventListener(event, touch, { passive: true });
  window.addEventListener("pagehide", () => reset());
  $("instance-disconnect").addEventListener("click", () => reset());
  function button(label, action) {
    const b = node("button", label);
    b.type = "button";
    b.disabled = busy;
    b.addEventListener("click", action);
    return b;
  }
  function isCurrent(connection) {
    return active === connection && !connection.controller.signal.aborted;
  }
  async function call(connection, path, body) {
    if (!isCurrent(connection)) throw new Error("Connection closed.");
    if (
      !["/v1/extras", "/v1/extras/install", "/v1/extras/remove"].includes(path)
    )
      throw new Error("Unsupported operation.");
    const result = await requestJSON(connection.origin + path, {
      token: connection.token,
      signal: connection.controller.signal,
      method: body ? "POST" : "GET",
      body,
      timeout: body ? 120000 : 10000,
    });
    if (!isCurrent(connection)) throw new Error("Connection closed.");
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("Invalid instance response.");
    if (
      result?.ok === false ||
      (typeof result?.status === "number" && result.status >= 400)
    )
      throw new Error("The instance rejected this operation.");
    return result;
  }
  async function refresh(connection) {
    const items = installed(await call(connection, "/v1/extras"));
    if (!isCurrent(connection)) return;
    connection.items = items;
    renderInstalled();
    renderActions();
  }
  function renderInstalled() {
    const container = $("instance-installed");
    container.replaceChildren();
    if (!active) return;
    container.append(node("h3", "Installed extras"));
    if (!active.items.length)
      container.append(node("p", "No extras installed."));
    for (const extra of active.items) {
      const row = node("div", undefined, "installed-row");
      row.append(
        node(
          "span",
          extra.id +
            " · " +
            extra.ref.slice(0, 12) +
            (extra.enabled
              ? " · configured version; restart applies changes"
              : " · removal pending restart"),
        ),
      );
      const actions = node("div", undefined, "button-row");
      if (extra.enabled && extras.some((item) => item.id === extra.id))
        actions.append(button("Edit version", () => editVersion(extra)));
      if (extra.enabled)
        actions.append(
          button("Remove", () => change("/v1/extras/remove", { id: extra.id })),
        );
      row.append(actions);
      container.append(row);
    }
  }
  function editVersion(extra) {
    if (!active || busy || !extras.some((item) => item.id === extra.id)) return;
    const value = window.prompt(
      "Enter the full 40-character commit SHA for " +
        extra.id +
        ". The bot owner must approve this version in the panel first.",
      extra.ref,
    );
    if (value === null) return;
    const ref = value.trim().toLowerCase();
    if (!SHA.test(ref)) {
      status("Enter a full 40-character Git commit SHA.");
      return;
    }
    if (ref === extra.ref) {
      status(
        "That commit is already configured. Restart the bot if a change is pending.",
      );
      return;
    }
    void change("/v1/extras/install", { id: extra.id, ref });
  }
  function renderActions() {
    document.querySelectorAll(".extra-actions").forEach((container) => {
      container.replaceChildren();
      const extra = extras.find((e) => e.id === container.dataset.extraId);
      if (!extra) return;
      if (!extra.ref) {
        container.append(
          node("p", "Remote installation awaits a reviewed, pinned release."),
        );
        return;
      }
      if (!active) return;
      const item = active.items.find((e) => e.id === extra.id && e.enabled);
      if (item?.ref === extra.ref) {
        container.append(
          node(
            "p",
            "Configured at this commit. Restart applies any pending change.",
          ),
        );
        return;
      }
      container.append(
        button(item ? "Update on instance" : "Install on instance", () =>
          change("/v1/extras/install", { id: extra.id, ref: extra.ref }),
        ),
      );
    });
  }
  async function change(path, body) {
    const connection = active;
    if (!connection || busy) return;
    const install = path === "/v1/extras/install";
    if (
      !window.confirm(
        (install ? "Install " : "Remove ") +
          body.id +
          " on " +
          connection.origin +
          (install
            ? "\nCommit: " +
              body.ref +
              "\nThis code runs with your bot’s host privileges."
            : "\nIts saved data will be preserved.") +
          "\nRestart the bot to apply the change.",
      )
    )
      return;
    if (!isCurrent(connection)) return;
    busy = true;
    renderActions();
    renderInstalled();
    status("Updating extras on " + connection.origin + "…");
    touch();
    try {
      await call(connection, path, body);
      await refresh(connection);
      if (isCurrent(connection))
        status(
          "Extras updated on " +
            connection.origin +
            ". Restart the bot to apply the change.",
        );
    } catch {
      if (isCurrent(connection))
        status(
          "Could not confirm the operation. It may have reached the bot; reconnect to check its state before retrying.",
        );
    } finally {
      if (isCurrent(connection)) {
        busy = false;
        renderActions();
        renderInstalled();
      }
    }
  }
  $("instance-connect").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = $("instance-token").value.trim();
    $("instance-token").value = "";
    reset();
    const revision = generation;
    let credential = raw;
    try {
      const origin = instanceOrigin($("instance-url").value.trim());
      if (!TOKEN.test(credential))
        throw new Error("Enter a Nationdex API token beginning with ndx_.");
      const controller = new AbortController();
      pending = controller;
      $("connect-button").disabled = true;
      status("Checking " + origin + "…");
      const discovery = await requestJSON(origin + "/v1/discovery", {
        signal: controller.signal,
        limit: 16384,
      });
      if (revision !== generation || controller.signal.aborted) return;
      if (
        discovery?.product !== "Project Nationdex 2026" ||
        discovery?.protocol?.extras !== 1
      )
        throw new Error(
          "This instance does not advertise a compatible extras API.",
        );
      const connection = { origin, token: credential, controller, items: [] };
      credential = "";
      active = connection;
      pending = null;
      await refresh(connection);
      if (isCurrent(connection)) {
        status("Connected to " + origin + ".");
        touch();
      }
    } catch (error) {
      if (revision === generation)
        reset(
          error instanceof Error
            ? error.message + " Check the address and allowed browser origin."
            : "Connection failed.",
        );
    } finally {
      credential = "";
      if (revision === generation) $("connect-button").disabled = false;
    }
  });
  function link(label, href) {
    const a = node("a", label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  function render() {
    const q = $("search-input").value.toLocaleLowerCase().trim();
    const filtered = extras.filter((e) =>
      [e.name, e.id, e.description].some((s) =>
        s.toLocaleLowerCase().includes(q),
      ),
    );
    $("extras-count").textContent =
      filtered.length + (filtered.length === 1 ? " extra" : " extras");
    const container = $("extras-list");
    container.replaceChildren();
    if (!filtered.length)
      container.append(node("p", "No extras match your search.", "muted"));
    for (const extra of filtered) {
      const card = node("article", undefined, "card");
      const heading = node("div", undefined, "card-heading");
      const title = node("div", undefined, "extra-title");
      title.append(node("h3", extra.name));
      if (extra.version)
        title.append(node("span", "v" + extra.version, "version"));
      const links = node("div", undefined, "extra-links");
      links.append(link("Repository", extra.repository.url));
      if (extra.homepage) links.append(link("Homepage", extra.homepage));
      heading.append(title, links);
      card.append(heading);
      if (extra.authors || extra.license)
        card.append(
          node(
            "p",
            [extra.authors, extra.license].filter(Boolean).join(" · "),
            "extra-meta",
          ),
        );
      card.append(node("p", extra.description, "extra-description"));
      if (extra.path)
        card.append(node("p", "Extra folder: " + extra.path, "extra-meta"));
      card.append(
        node(
          "p",
          Number.isSafeInteger(extra.unpackedBytes)
            ? "Estimated unpacked files: " +
                sizeLabel(extra.unpackedBytes) +
                ". Excludes Git transfer overhead and separately provided dependencies."
            : "Unpacked size unavailable" +
                (extra.ref
                  ? ". GitHub may be unavailable or rate limited."
                  : " until a reviewed commit is pinned."),
          "extra-meta",
        ),
      );
      if (extra.error) card.append(node("p", extra.error, "error"));
      const actions = node("div", undefined, "extra-actions");
      actions.dataset.extraId = extra.id;
      card.append(actions);
      container.append(card);
    }
    renderActions();
  }
  $("search-input").addEventListener("input", render);
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab) {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !selected;
    }
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const next =
        event.key === "ArrowRight"
          ? (i + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (i + tabs.length - 1) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : -1;
      if (next >= 0) {
        event.preventDefault();
        select(tabs[next]);
        tabs[next].focus();
      }
    });
  });
  let theme;
  try {
    theme = localStorage.getItem("theme");
  } catch {
    /* storage is optional */
  }
  const media = matchMedia("(prefers-color-scheme: dark)");
  const setTheme = (dark) => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme-toggle").setAttribute("aria-pressed", String(dark));
  };
  setTheme(theme === "dark" || (theme !== "light" && media.matches));
  $("theme-toggle").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    setTheme(dark);
    theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* storage is optional */
    }
  });
  media.addEventListener("change", () => {
    if (!theme) setTheme(media.matches);
  });
  document.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($(b.dataset.copy).textContent);
        $("copy-status").textContent = "Copied.";
      } catch {
        $("copy-status").textContent =
          "Copy unavailable. Select the code and copy it manually.";
      }
    }),
  );
  requestJSON("assets/examples.json", { limit: 16384 })
    .then((data) => {
      for (const key of [
        "structure",
        "package",
        "manifest",
        "entrypoint",
        "prefix",
        "slash",
      ])
        $("code-example-" + key).textContent = text(data[key], 8000);
    })
    .catch(() => {
      $("copy-status").textContent = "Could not load examples.";
    });
  async function init() {
    try {
      const entries = catalogue(await requestJSON("data/extras.json"));
      extras = entries.map((e) => metadata({}, e));
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, entries.length) }, async () => {
          while (next < entries.length) {
            const i = next++;
            const entry = entries[i];
            const revision = (entry.ref || entry.branch)
              .split("/")
              .map(encodeURIComponent)
              .join("/");
            try {
              extras[i] = metadata(
                await requestJSON(
                  "https://raw.githubusercontent.com/" +
                    entry.repository.owner +
                    "/" +
                    entry.repository.repo +
                    "/" +
                    revision +
                    (entry.path
                      ? "/" +
                        entry.path.split("/").map(encodeURIComponent).join("/")
                      : "") +
                    "/package.json",
                  { allowPlainText: true },
                ),
                entry,
              );
            } catch {
              extras[i].error =
                "Could not load package metadata. View the repository for details.";
            }
            try {
              extras[i].unpackedBytes = await estimateSize(entry);
            } catch {
              extras[i].unpackedBytes = null;
            }
          }
        }),
      );
      render();
    } catch {
      $("extras-count").textContent = "Could not load the extras catalogue.";
      $("extras-list").replaceChildren(
        node(
          "p",
          "The catalogue is unavailable or invalid. No remote installation is offered.",
          "error",
        ),
      );
    }
  }
  void init();
}
if (typeof document !== "undefined") start();
