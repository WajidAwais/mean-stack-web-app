/* global api, say, formData */
const homeFor = (user) => (user.role === "admin" ? "admin.html" : "ballot.html");

api.get("/session").then((me) => { if (me) location.replace(homeFor(me)); }).catch(() => {});

document.getElementById("signin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("signin-status");
  const { roll_number, password } = formData(event.target);
  if (!roll_number || !password) return say(status, "Enter your roll number and password.", "error");
  say(status, "Signing in…");
  try {
    const user = await api.post("/login", { roll_number, password });
    location.replace(homeFor(user));
  } catch (err) {
    say(status, err.status === 401 ? "That roll number and password do not match." : err.message, "error");
  }
});

document.getElementById("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.getElementById("register-status");
  if (!event.target.checkValidity()) {
    event.target.reportValidity();
    return say(status, "Fill in every field; the password needs at least 8 characters.", "error");
  }
  const body = formData(event.target);
  body.batch = Number(body.batch);
  say(status, "Creating your account…");
  try {
    const user = await api.post("/signup", body);
    location.replace(homeFor(user));
  } catch (err) {
    say(status, err.status === 409 ? "That roll number is already registered. Sign in instead." : err.message, "error");
  }
});
