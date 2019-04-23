// Thin client for the e-ballot JSON API plus a few DOM helpers shared by the pages.
const api = {
  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let payload = { status: res.status, data: null, message: res.statusText };
    try { payload = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) {
      const err = new Error(describeError(payload));
      err.status = res.status;
      throw err;
    }
    return payload.data;
  },
  get: (path) => api.request("GET", path),
  post: (path, body) => api.request("POST", path, body),
  put: (path, body) => api.request("PUT", path, body),
  patch: (path, body) => api.request("PATCH", path, body),
  del: (path) => api.request("DELETE", path),
};

function describeError(payload) {
  const errors = payload.data && payload.data.errors;
  if (errors && errors.length) return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
  return payload.message || "something went wrong";
}

// Loads the signed-in user, or sends the visitor back to the sign-in page.
async function requireUser(role) {
  let me = null;
  try {
    me = await api.get("/session");
  } catch {
    me = null;
  }
  if (!me) {
    location.replace("index.html");
    return null;
  }
  if (role && me.role !== role) {
    location.replace(me.role === "admin" ? "admin.html" : "ballot.html");
    return null;
  }
  return me;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function say(region, text, kind = "info") {
  region.className = kind === "error" ? "notice notice--error" : "notice";
  region.textContent = text;
}

function formData(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
}

function bindSignOut() {
  const link = document.getElementById("sign-out");
  if (!link) return;
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await api.post("/signout").catch(() => {});
    location.replace("index.html");
  });
}

function showWhoami(me) {
  const slot = document.getElementById("whoami");
  if (slot) slot.textContent = me.role === "admin" ? `${me.username} · admin` : `${me.username} · batch ${me.Batch}`;
  for (const link of document.querySelectorAll("[data-home]")) {
    link.href = me.role === "admin" ? "admin.html" : "ballot.html";
  }
}
