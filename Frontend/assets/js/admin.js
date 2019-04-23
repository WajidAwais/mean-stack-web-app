/* global api, el, say, formData, requireUser, bindSignOut, showWhoami */
bindSignOut();

const rows = document.getElementById("candidate-rows");
const caption = document.getElementById("candidates-caption");
const filter = document.getElementById("batch-filter");
const candidatesStatus = document.getElementById("candidates-status");

async function removeCandidate(c) {
  if (!confirm(`Remove ${c.username} from the ballot? Votes cast for them become void and those voters can vote again.`)) return;
  try {
    await api.del(`/admin/deletecandidate/${encodeURIComponent(c.roll_num)}`);
    say(candidatesStatus, `${c.username} was removed.`);
    loadCandidates();
  } catch (err) {
    say(candidatesStatus, err.message, "error");
  }
}

async function loadCandidates() {
  caption.textContent = "Loading candidates…";
  try {
    const all = await api.get("/admin/view_candidate_list");
    const batches = [...new Set(all.map((c) => c.batch))];
    const chosen = filter.value;
    filter.replaceChildren(el("option", { value: "" }, "All batches"), ...batches.map((b) => el("option", { value: String(b) }, `Batch ${b}`)));
    filter.value = batches.map(String).includes(chosen) ? chosen : "";
    const shown = filter.value ? all.filter((c) => String(c.batch) === filter.value) : all;
    rows.replaceChildren(...shown.map((c) =>
      el("tr", {},
        el("td", {}, c.username),
        el("td", { class: "mono" }, c.roll_num),
        el("td", {}, String(c.batch)),
        el("td", {}, c.College),
        el("td", {}, el("button", { type: "button", class: "button--danger", onclick: () => removeCandidate(c), "aria-label": `Remove ${c.username}` }, "Remove")),
      )));
    caption.textContent = shown.length ? `${shown.length} candidate${shown.length === 1 ? "" : "s"}` : "No candidates yet. Add the first one below.";
  } catch (err) {
    caption.textContent = "";
    say(candidatesStatus, `Could not load candidates: ${err.message}`, "error");
  }
}

filter.addEventListener("change", loadCandidates);

document.getElementById("candidate-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("candidate-form-status");
  const body = formData(event.target);
  body.batch = Number(body.batch);
  body.Skills = body.Skills ? body.Skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
  try {
    const created = await api.post("/admin/addCandidate", body);
    event.target.reset();
    say(status, `${created.username} is now on the batch ${created.batch} ballot.`);
    loadCandidates();
  } catch (err) {
    say(status, err.status === 409 ? "A candidate with that roll number already exists." : err.message, "error");
  }
});

async function removeVoter(v, item) {
  if (!confirm(`Delete the account of ${v.username}? Their vote, if any, is withdrawn.`)) return;
  const status = document.getElementById("voter-status");
  try {
    await api.del(`/admin/deletevoter/${encodeURIComponent(v.roll_number)}`);
    item.remove();
    say(status, `${v.username}'s account was deleted.`);
    loadCandidates();
  } catch (err) {
    say(status, err.message, "error");
  }
}

document.getElementById("voter-search").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("voter-status");
  const list = document.getElementById("voter-results");
  const q = formData(event.target).q;
  if (!q) return;
  try {
    const [byName, byRoll] = await Promise.all([
      api.get(`/admin/searchvoterUname/${encodeURIComponent(q)}`),
      api.get(`/admin/searchvoterRoll/${encodeURIComponent(q)}`),
    ]);
    const seen = new Map([...byRoll, ...byName].map((v) => [v.roll_number, v]));
    const voters = [...seen.values()];
    list.replaceChildren(...voters.map((v) => {
      const item = el("li", { class: "voter-row" },
        el("span", {}, v.username, el("br"), el("span", { class: "mono hint" }, `${v.roll_number} · batch ${v.Batch ?? "?"}`)),
        el("span", { class: "hint" }, v.hasVoted ? "has voted" : "not voted"));
      item.append(el("button", { type: "button", class: "button--danger", onclick: () => removeVoter(v, item), "aria-label": `Delete ${v.username}` }, "Delete"));
      return item;
    }));
    say(status, voters.length ? `${voters.length} voter${voters.length === 1 ? "" : "s"} found.` : "No voter matches that name or roll number.");
  } catch (err) {
    say(status, err.message, "error");
  }
});

requireUser("admin").then((me) => {
  if (!me) return;
  showWhoami(me);
  loadCandidates();
});
