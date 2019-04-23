/* global api, el, say, requireUser, bindSignOut, showWhoami */
bindSignOut();

// Set through the CSSOM: the CSP forbids inline style attributes.
function fill(share) {
  const bar = el("span", { class: "tally__fill" });
  bar.style.width = `${share * 100}%`;
  return bar;
}

function batchSection(batch) {
  const top = Math.max(1, ...batch.standings.map((c) => c.votes));
  const winners = new Set(batch.winners.map((w) => w.roll_num));
  const headline = batch.winners.length
    ? `${batch.winners.length > 1 ? "Tied" : "Leading"}: ${batch.winners.map((w) => w.username).join(" and ")}`
    : "No votes cast yet";
  return el("section", { class: "sheet", "aria-labelledby": `batch-${batch.batch}` },
    el("h2", { id: `batch-${batch.batch}` }, `Batch ${batch.batch}`),
    el("p", { class: "lede" }, `${headline} · ${batch.totalVotes} ${batch.totalVotes === 1 ? "vote" : "votes"} in total`),
    el("ol", { class: "tally" },
      batch.standings.map((c) =>
        el("li", { class: winners.has(c.roll_num) ? "tally__row tally__row--winner" : "tally__row" },
          el("span", { class: "tally__name" }, c.username),
          el("span", { class: "tally__bar", "aria-hidden": "true" }, fill(c.votes / top)),
          el("span", { class: "tally__votes" }, String(c.votes), el("span", { class: "sr-only" }, " votes")),
        ),
      ),
    ),
  );
}

async function load() {
  const me = await requireUser();
  if (!me) return;
  showWhoami(me);
  const loading = document.getElementById("results-loading");
  try {
    const batches = await api.get(me.role === "admin" ? "/admin/results" : "/voter/results");
    loading.remove();
    const target = document.getElementById("results");
    if (!batches.length) {
      target.append(el("p", { class: "empty" }, "No candidates have been added yet, so there is nothing to count."));
      return;
    }
    target.replaceChildren(...batches.map(batchSection));
  } catch (err) {
    loading.remove();
    say(document.getElementById("results-status"), `Could not load results: ${err.message}`, "error");
  }
}

load();
