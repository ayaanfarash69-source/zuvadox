const form = document.querySelector("[data-login-form]");
const statusCard = document.querySelector("[data-login-status]");
const nextField = document.querySelector("[data-next-field]");
const submitButton = form.querySelector("button[type='submit']");
const params = new URLSearchParams(window.location.search);
const next = sanitizeNextPath(params.get("next"));

nextField.value = next;
checkSession();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Signing in...", "pending");
  submitButton.disabled = true;

  try {
    const payload = {
      username: form.elements.username.value.trim(),
      password: form.elements.password.value,
      next
    };

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not sign in.");
    }

    window.location.href = sanitizeNextPath(data.next);
  } catch (error) {
    showStatus(error.message || "Could not sign in.", "error");
    submitButton.disabled = false;
  }
});

async function checkSession() {
  try {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    const data = await response.json();

    if (data.authenticated) {
      window.location.href = next;
      return;
    }

    if (!data.authConfigured) {
      showStatus(
        "Admin login is not configured yet. Add credentials in admin-credentials.json or server environment settings.",
        "error"
      );
      submitButton.disabled = true;
    }
  } catch {
    showStatus("Could not verify admin access right now.", "error");
  }
}

function sanitizeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin.html";
  }

  return value;
}

function showStatus(message, variant) {
  statusCard.textContent = message;
  statusCard.classList.remove("is-hidden", "is-pending", "is-success", "is-error");
  statusCard.classList.add(`is-${variant}`);
}
