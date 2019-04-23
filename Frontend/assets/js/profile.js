/* global api, say, formData, requireUser, bindSignOut, showWhoami */
bindSignOut();

async function load() {
  const me = await requireUser();
  if (!me) return;
  showWhoami(me);
  const base = me.role === "admin" ? "/admin" : "/voter";
  const form = document.getElementById("profile-form");
  const values = {
    username: me.username, phone: me.phone_number, address: me.Address,
    gender: me.Gender, batch: me.Batch, dob: me.dob ? me.dob.slice(0, 10) : "",
  };
  for (const [name, value] of Object.entries(values)) form.elements[name].value = value ?? "";
  if (me.hasVoted) form.elements.batch.disabled = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("profile-status");
    const body = formData(form);
    if (body.batch) body.batch = Number(body.batch);
    try {
      const updated = await api.put(`${base}/UpdateProfile`, body);
      showWhoami(updated);
      say(status, "Details saved.");
    } catch (err) {
      say(status, err.message, "error");
    }
  });

  document.getElementById("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("password-status");
    try {
      await api.patch(`${base}/changePassword`, formData(event.target));
      event.target.reset();
      say(status, "Password changed.");
    } catch (err) {
      say(status, err.status === 403 ? "The current password is wrong." : err.message, "error");
    }
  });
}

load();
