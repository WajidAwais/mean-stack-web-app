/* global api, el, say, requireUser, bindSignOut, showWhoami */
bindSignOut();

function renderVoteState(me, chosen) {
  const box = document.getElementById("vote-state");
  box.replaceChildren();
  if (me.hasVoted) {
    box.append(
      el("p", {}, el("span", { class: "stamp" }, "Ballot cast")),
      el("p", {}, chosen ? `You voted for ${chosen.username}.` : "Your vote has been counted. Ballots are secret, so the choice is not shown again."),
    );
  } else {
    box.append(el("p", {}, `You have not voted yet. Candidates shown are those standing for batch ${me.Batch}.`));
  }
}

function candidateRow(c, disabled) {
  const details = [c.College, c.school].filter(Boolean).join(" · ");
  return el("li", { class: "ballot__item" },
    el("label", { class: "ballot__choice" },
      el("input", { type: "radio", name: "roll", value: c.roll_num, required: true, disabled }),
      el("span", { class: "ballot__box", "aria-hidden": "true" }, "✓"),
      el("span", {},
        el("span", { class: "ballot__name" }, c.username),
        el("br"),
        el("span", { class: "ballot__meta" }, el("span", { class: "mono" }, c.roll_num), details ? ` · ${details}` : ""),
      ),
    ),
  );
}

async function load() {
  const me = await requireUser("voter");
  if (!me) return;
  showWhoami(me);
  renderVoteState(me);

  const list = document.getElementById("ballot-list");
  const loading = document.getElementById("ballot-loading");
  const status = document.getElementById("ballot-status");
  const button = document.getElementById("cast-button");
  try {
    const candidates = await api.get("/voter/homepage");
    loading.remove();
    if (!candidates.length) {
      list.replaceWith(el("p", { class: "empty" }, `No candidates are standing for batch ${me.Batch} yet. Check back once the election office has published the list.`));
      return;
    }
    list.replaceChildren(...candidates.map((c) => candidateRow(c, me.hasVoted)));
    if (me.hasVoted) {
      document.getElementById("ballot-intro").textContent = "Your ballot is already in the box. The list stays here for reference.";
      return;
    }
    button.hidden = false;
    document.getElementById("ballot-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const picked = event.target.querySelector("input[name=roll]:checked");
      if (!picked) return say(status, "Mark one box before casting your ballot.", "error");
      const chosen = candidates.find((c) => c.roll_num === picked.value);
      if (!confirm(`Cast your ballot for ${chosen.username}? This cannot be undone.`)) return;
      button.disabled = true;
      try {
        await api.patch("/voter/castVote", { roll: picked.value });
        me.hasVoted = true;
        for (const input of list.querySelectorAll("input")) input.disabled = true;
        button.hidden = true;
        say(status, "Your ballot has been cast. Thank you for voting.");
        renderVoteState(me, chosen);
      } catch (err) {
        button.disabled = false;
        say(status, err.message, "error");
      }
    });
  } catch (err) {
    loading.remove();
    say(status, `Could not load the ballot: ${err.message}`, "error");
  }
}

load();
