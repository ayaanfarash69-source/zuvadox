const form = document.querySelector("[data-upload-form]");
const statusCard = document.querySelector("[data-status]");
const fileSummary = document.querySelector("[data-file-summary]");
const fileList = document.querySelector("[data-file-list]");
const submitButton = form.querySelector("button[type='submit']");
const fileInput = form.querySelector("input[type='file']");
const consentCheckbox = form.elements.consent;
const consentRow = form.querySelector(".consent-row");
const pageShell = document.querySelector(".page-shell");
const yearSlot = document.querySelector("[data-year]");
const soundToggle = document.querySelector("[data-sound-toggle]");
const soundLabel = document.querySelector("[data-sound-label]");
const MAX_FILES = 10;
const SOUND_STORAGE_KEY = "zuvaCalmingSoundEnabled";

let audioContext = null;
let masterGain = null;
let padLayer = null;
let pulseLfo = null;
let chimeIntervalId = null;
let soundEnabled = false;

if (yearSlot) {
  yearSlot.textContent = new Date().getFullYear();
}

initializeSoundToggle();

consentCheckbox.addEventListener("change", () => {
  if (consentCheckbox.checked) {
    setConsentInvalid(false);
  }
});

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    fileInput.setCustomValidity("");
    fileSummary.textContent = "No files selected yet.";
    fileList.innerHTML = "";
    fileList.classList.add("is-hidden");
    return;
  }

  if (files.length > MAX_FILES) {
    fileInput.setCustomValidity(`Please choose no more than ${MAX_FILES} files.`);
    fileInput.reportValidity();
    showStatus(`Please choose up to ${MAX_FILES} files in one submission.`, "error");
    return;
  }

  fileInput.setCustomValidity("");
  fileSummary.textContent = `${files.length} file(s) selected. ${MAX_FILES - files.length} slot(s) remaining.`;
  fileList.innerHTML = files
    .map(
      (file) => `
        <li>
          <span>${escapeHtml(file.name)}</span>
          <strong>${formatFileSize(file.size)}</strong>
        </li>
      `
    )
    .join("");
  fileList.classList.remove("is-hidden");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = Array.from(fileInput.files || []);

  if (!consentCheckbox.checked) {
    setConsentInvalid(true);
    triggerConsentAlert();
    showStatus("Please tick the consent checkbox before uploading documents.", "error");
    return;
  }

  if (files.length > MAX_FILES) {
    showStatus(`Please choose up to ${MAX_FILES} files in one submission.`, "error");
    return;
  }

  showStatus("Uploading documents. Please wait...", "pending");
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: new FormData(form)
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }

    const uploadedCount = files.length;
    form.reset();
    setConsentInvalid(false);
    fileSummary.textContent = "No files selected yet.";
    fileList.innerHTML = "";
    fileList.classList.add("is-hidden");
    showStatus(
      `Upload complete. ${uploadedCount} file(s) received. Reference number: ${payload.submissionId}. Your documents are now with the Zuva team.`,
      "success"
    );
  } catch (error) {
    showStatus(error.message || "Something went wrong during upload.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

function showStatus(message, variant) {
  statusCard.textContent = message;
  statusCard.classList.remove("is-hidden", "is-pending", "is-success", "is-error");
  statusCard.classList.add(`is-${variant}`);
}

function setConsentInvalid(isInvalid) {
  consentRow.classList.toggle("is-invalid", isInvalid);
  consentCheckbox.setAttribute("aria-invalid", isInvalid ? "true" : "false");
}

function triggerConsentAlert() {
  pageShell.classList.remove("is-screen-shaking");
  void pageShell.offsetWidth;
  pageShell.classList.add("is-screen-shaking");
  window.setTimeout(() => {
    pageShell.classList.remove("is-screen-shaking");
  }, 420);

  if (typeof navigator.vibrate === "function") {
    navigator.vibrate([120, 70, 120]);
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initializeSoundToggle() {
  if (!soundToggle || !soundLabel) {
    return;
  }

  soundEnabled = window.localStorage.getItem(SOUND_STORAGE_KEY) === "on";
  updateSoundUi();

  soundToggle.addEventListener("click", async () => {
    if (soundEnabled) {
      disableCalmingSound();
      return;
    }

    try {
      await enableCalmingSound();
    } catch {
      soundLabel.textContent = "Sound unavailable";
      soundToggle.setAttribute("aria-pressed", "false");
    }
  });
}

async function enableCalmingSound() {
  if (!audioContext) {
    setupCalmingAudio();
  }

  if (!audioContext) {
    throw new Error("Audio not supported.");
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  soundEnabled = true;
  window.localStorage.setItem(SOUND_STORAGE_KEY, "on");
  startCalmingSound();
  updateSoundUi();
}

function disableCalmingSound() {
  soundEnabled = false;
  window.localStorage.setItem(SOUND_STORAGE_KEY, "off");

  if (chimeIntervalId) {
    window.clearInterval(chimeIntervalId);
    chimeIntervalId = null;
  }

  if (audioContext && audioContext.state === "running") {
    audioContext.suspend().catch(() => {});
  }

  updateSoundUi();
}

function setupCalmingAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) {
    return;
  }

  audioContext = new Context();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.022;
  masterGain.connect(audioContext.destination);

  const lowpass = audioContext.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 720;
  lowpass.Q.value = 0.3;
  lowpass.connect(masterGain);

  const padGain = audioContext.createGain();
  padGain.gain.value = 0.45;
  padGain.connect(lowpass);

  const baseFrequencies = [196, 246.94, 293.66];
  const oscillators = baseFrequencies.map((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index === 1 ? 4 : index === 2 ? -5 : 0;
    oscillator.connect(padGain);
    oscillator.start();
    return oscillator;
  });

  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.09;
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(padGain.gain);
  lfo.start();

  padLayer = { lowpass, padGain, oscillators };
  pulseLfo = lfo;
}

function startCalmingSound() {
  if (!audioContext || !masterGain || !padLayer) {
    return;
  }

  if (!chimeIntervalId) {
    playSoftChime();
    chimeIntervalId = window.setInterval(playSoftChime, 14000);
  }
}

function playSoftChime() {
  if (!audioContext || !masterGain) {
    return;
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1600;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.035, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);

  filter.connect(gain);
  gain.connect(masterGain);

  const tones = [523.25, 659.25];
  tones.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index === 0 ? 0 : 6, now);
    oscillator.connect(filter);
    oscillator.start(now + index * 0.08);
    oscillator.stop(now + 6);
  });
}

function updateSoundUi() {
  if (!soundToggle || !soundLabel) {
    return;
  }

  soundToggle.classList.toggle("is-active", soundEnabled);
  soundToggle.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  soundLabel.textContent = soundEnabled ? "Calming Sound On" : "Calming Sound Off";
}
