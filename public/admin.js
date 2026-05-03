const listHost = document.querySelector("[data-submission-list]");
const countHost = document.querySelector("[data-submission-count]");
const documentCountHost = document.querySelector("[data-document-count]");
const logoutButton = document.querySelector("[data-logout-button]");

loadSubmissions();

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      await fetch("/api/admin/logout", {
        method: "POST"
      });
    } finally {
      window.location.href = "/login.html?next=/admin.html";
    }
  });
}

async function loadSubmissions() {
  try {
    const response = await fetch("/api/submissions", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login.html?next=/admin.html";
      return;
    }

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load submissions.");
    }

    const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
    countHost.textContent = String(submissions.length);
    documentCountHost.textContent = String(
      submissions.reduce((total, submission) => total + (submission.files?.length || 0), 0)
    );

    if (!submissions.length) {
      return;
    }

    listHost.innerHTML = submissions.map(renderSubmissionCard).join("");
  } catch (error) {
    listHost.innerHTML = `
      <article class="empty-state">
        <h3>Unable to load submissions</h3>
        <p>${escapeHtml(error.message || "Unknown error")}</p>
      </article>
    `;
  }
}

function renderSubmissionCard(submission) {
  const submittedAt = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString()
    : "Unknown date";
  const files = Array.isArray(submission.files) ? submission.files : [];

  return `
    <article class="submission-card">
      <div class="submission-top">
        <div>
          <p class="eyebrow">Reference ${escapeHtml(submission.id || "Unknown")}</p>
          <h3>${escapeHtml(submission.client?.fullName || "Unnamed client")}</h3>
        </div>
        <div class="submission-pill-row">
          <span class="service-pill">${escapeHtml(submission.serviceType || "General case")}</span>
          <span class="service-pill secondary-pill">${files.length} file(s)</span>
        </div>
      </div>

      <div class="submission-grid">
        <p><strong>Email:</strong> ${escapeHtml(submission.client?.email || "-")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(submission.client?.phone || "-")}</p>
        <p><strong>Nationality:</strong> ${escapeHtml(submission.client?.nationality || "-")}</p>
        <p><strong>Residence:</strong> ${escapeHtml(submission.client?.countryOfResidence || "-")}</p>
        <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
        <p><strong>Consent:</strong> ${submission.consent ? "Yes" : "No"}</p>
      </div>

      <div class="notes-block">
        <strong>Case notes</strong>
        <p>${escapeHtml(submission.caseNotes || "No extra notes added.")}</p>
      </div>

      <div class="files-panel">
        <div class="files-head">
          <strong>Uploaded documents</strong>
          <span>${files.length} file(s)</span>
        </div>

        <div class="file-list">
        ${files
          .map(
            (file) => `
              <a href="${escapeAttribute(file.url || "#")}" target="_blank" rel="noreferrer">
                <span class="file-link-name">${escapeHtml(file.originalName || "Document")}</span>
                <span class="file-link-meta">${formatFileSize(file.size || 0)}</span>
              </a>
            `
          )
          .join("")}
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}
