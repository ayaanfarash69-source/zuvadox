const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const STORAGE_ROOT = process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT) : ROOT_DIR;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(STORAGE_ROOT, "data");
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(STORAGE_ROOT, "uploads");
const ADMIN_CREDENTIALS_FILE = path.join(ROOT_DIR, "admin-credentials.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const MAX_REQUEST_SIZE = 25 * 1024 * 1024;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const SESSION_COOKIE_NAME = "zuva_admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const adminCredentials = readAdminCredentials();
const ADMIN_USERNAME = adminCredentials.username;
const ADMIN_PASSWORD = adminCredentials.password;
const SESSION_SECRET = adminCredentials.sessionSecret;
const isAdminAuthConfigured = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && SESSION_SECRET);
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);
const allowedMimeTypes = new Set([
  "application/msword",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);

ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && (url.pathname === "/login" || url.pathname === "/login.html")) {
      if (isAdminAuthenticated(req)) {
        return redirect(res, sanitizeNextPath(url.searchParams.get("next")));
      }

      return sendFile(res, path.join(PUBLIC_DIR, "login.html"), { "Cache-Control": "no-store" });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/session") {
      return sendJson(
        res,
        200,
        {
          authConfigured: isAdminAuthConfigured,
          authenticated: isAdminAuthenticated(req)
        },
        { "Cache-Control": "no-store" }
      );
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      return handleAdminLogin(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      return handleAdminLogout(req, res);
    }

    if (req.method === "GET" && url.pathname === "/") {
      return sendFile(res, path.join(PUBLIC_DIR, "index.html"));
    }

    if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin.html")) {
      if (!ensureAdminAccess(req, res, url, { api: false })) {
        return;
      }

      return sendFile(res, path.join(PUBLIC_DIR, "admin.html"), { "Cache-Control": "no-store" });
    }

    if (req.method === "GET" && url.pathname === "/api/submissions") {
      if (!ensureAdminAccess(req, res, url, { api: true })) {
        return;
      }

      const submissions = await readSubmissions();
      return sendJson(res, 200, { submissions }, { "Cache-Control": "no-store" });
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      return handleUpload(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/uploads/")) {
      if (!ensureAdminAccess(req, res, url, { api: false })) {
        return;
      }

      return sendSafeFile(res, UPLOADS_DIR, url.pathname.slice("/uploads/".length));
    }

    if (req.method === "GET") {
      return sendSafeFile(res, PUBLIC_DIR, url.pathname.slice(1));
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    const statusCode = Number(error.statusCode || 500);
    const message =
      statusCode >= 500
        ? "Something went wrong while processing the request."
        : String(error.message || "Request could not be completed.");
    sendJson(res, statusCode, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Zuva client portal running on http://localhost:${PORT}`);
  console.log(`Storage root: ${STORAGE_ROOT}`);
  console.log(`Admin auth configured: ${isAdminAuthConfigured ? "yes" : "no"}`);
});

async function handleUpload(req, res) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_REQUEST_SIZE) {
    return sendJson(res, 413, {
      error: "Upload is too large. Please keep the total submission under 25 MB."
    });
  }

  const request = new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: "half"
  });

  const formData = await request.formData();
  const fullName = getText(formData, "fullName");
  const email = getText(formData, "email");
  const phone = getText(formData, "phone");
  const nationality = getText(formData, "nationality");
  const countryOfResidence = getText(formData, "countryOfResidence");
  const serviceType = getText(formData, "serviceType");
  const caseNotes = getText(formData, "caseNotes");
  const consent = formData.get("consent") === "on";
  const files = formData
    .getAll("documents")
    .filter((item) => item && typeof item === "object" && typeof item.arrayBuffer === "function");

  if (!fullName || !email || !serviceType || !consent) {
    return sendJson(res, 400, {
      error: "Please complete the required client details and accept the consent checkbox."
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: "Please enter a valid email address." });
  }

  if (!files.length) {
    return sendJson(res, 400, { error: "Please upload at least one document." });
  }

  if (files.length > MAX_FILES) {
    return sendJson(res, 400, { error: "Please upload no more than 10 files at once." });
  }

  const validatedFiles = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const originalName = String(file.name || `document-${index + 1}`);
    const extension = path.extname(originalName).toLowerCase();
    const normalizedType = String(file.type || "").toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return sendJson(res, 400, {
        error: `Unsupported file type for ${originalName}. Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG.`
      });
    }

    if (normalizedType && !allowedMimeTypes.has(normalizedType)) {
      return sendJson(res, 400, {
        error: `Unsupported file content for ${originalName}.`
      });
    }

    if (Number(file.size || 0) > MAX_FILE_SIZE) {
      return sendJson(res, 400, {
        error: `${originalName} is too large. Each file must be 10 MB or smaller.`
      });
    }

    validatedFiles.push({
      file,
      index,
      originalName,
      normalizedType
    });
  }

  const submissionId = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(4).toString("hex")}`;
  const submissionDir = path.join(UPLOADS_DIR, submissionId);
  await fsp.mkdir(submissionDir, { recursive: true });

  const storedFiles = [];

  for (const { file, index, originalName, normalizedType } of validatedFiles) {

    const safeName = sanitizeFilename(originalName);
    const storedName = `${String(index + 1).padStart(2, "0")}-${Date.now()}-${safeName}`;
    const filePath = path.join(submissionDir, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fsp.writeFile(filePath, buffer);

    storedFiles.push({
      originalName,
      storedName,
      size: buffer.byteLength,
      type: normalizedType || "unknown",
      url: `/uploads/${encodeURIComponent(submissionId)}/${encodeURIComponent(storedName)}`
    });
  }

  const submission = {
    id: submissionId,
    submittedAt: new Date().toISOString(),
    client: {
      fullName,
      email,
      phone,
      nationality,
      countryOfResidence
    },
    serviceType,
    caseNotes,
    consent,
    files: storedFiles
  };

  const submissions = await readSubmissions();
  submissions.unshift(submission);
  await fsp.writeFile(SUBMISSIONS_FILE, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");

  sendJson(res, 200, {
    message: "Documents received successfully.",
    submissionId
  });
}

async function handleAdminLogin(req, res) {
  if (!isAdminAuthConfigured) {
    return sendJson(
      res,
      503,
      { error: "Admin login is not configured on this server." },
      { "Cache-Control": "no-store" }
    );
  }

  const rawBody = await readRequestBody(req, 64 * 1024);
  const contentType = String(req.headers["content-type"] || "").toLowerCase();

  let username = "";
  let password = "";
  let next = "/admin.html";

  if (contentType.includes("application/json")) {
    let payload = {};

    try {
      payload = JSON.parse(rawBody || "{}");
    } catch {
      return sendJson(
        res,
        400,
        { error: "Login request must contain valid JSON." },
        { "Cache-Control": "no-store" }
      );
    }

    username = String(payload.username || "").trim();
    password = String(payload.password || "");
    next = sanitizeNextPath(payload.next);
  } else {
    const payload = new URLSearchParams(rawBody);
    username = String(payload.get("username") || "").trim();
    password = String(payload.get("password") || "");
    next = sanitizeNextPath(payload.get("next"));
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return sendJson(
      res,
      401,
      { error: "Invalid username or password." },
      { "Cache-Control": "no-store" }
    );
  }

  sendJson(
    res,
    200,
    {
      authenticated: true,
      next
    },
    {
      "Cache-Control": "no-store",
      "Set-Cookie": serializeSessionCookie(createSessionToken(ADMIN_USERNAME), req)
    }
  );
}

function handleAdminLogout(req, res) {
  sendJson(
    res,
    200,
    { loggedOut: true },
    {
      "Cache-Control": "no-store",
      "Set-Cookie": serializeExpiredSessionCookie(req)
    }
  );
}

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, "[]\n", "utf8");
  }
}

function readAdminCredentials() {
  let fileCredentials = {};

  try {
    if (fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
      fileCredentials = JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_FILE, "utf8"));
    }
  } catch (error) {
    console.error(`Could not read admin credentials from ${ADMIN_CREDENTIALS_FILE}.`, error);
  }

  return {
    username: String(process.env.ADMIN_USERNAME || fileCredentials.username || "").trim(),
    password: String(process.env.ADMIN_PASSWORD || fileCredentials.password || ""),
    sessionSecret: String(process.env.SESSION_SECRET || fileCredentials.sessionSecret || "").trim()
  };
}

async function readSubmissions() {
  try {
    const raw = await fsp.readFile(SUBMISSIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function getText(formData, fieldName) {
  return String(formData.get(fieldName) || "").trim();
}

function sanitizeFilename(fileName) {
  const base = path.basename(fileName);
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "") || "document";
}

function ensureAdminAccess(req, res, url, { api }) {
  if (isAdminAuthenticated(req)) {
    return true;
  }

  if (api) {
    sendJson(
      res,
      401,
      { error: "Admin sign-in required." },
      { "Cache-Control": "no-store" }
    );
    return false;
  }

  redirect(res, `/login.html?next=${encodeURIComponent(url.pathname + url.search)}`);
  return false;
}

function isAdminAuthenticated(req) {
  if (!isAdminAuthConfigured) {
    return false;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return false;
  }

  const tokenParts = token.split(".");
  if (tokenParts.length !== 2) {
    return false;
  }

  const [payload, signature] = tokenParts;
  const expectedSignature = signValue(payload);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.username === ADMIN_USERNAME && Number(parsed.expiresAt || 0) > Date.now();
  } catch {
    return false;
  }
}

function createSessionToken(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + SESSION_DURATION_MS
    })
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

function signValue(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function serializeSessionCookie(token, req) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`
  ];

  if (shouldUseSecureCookies(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function serializeExpiredSessionCookie(req) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];

  if (shouldUseSecureCookies(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function shouldUseSecureCookies(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  return isProduction || forwardedProto === "https";
}

function sanitizeNextPath(nextValue) {
  if (!nextValue || typeof nextValue !== "string") {
    return "/admin.html";
  }

  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) {
    return "/admin.html";
  }

  return nextValue;
}

async function readRequestBody(req, maxSize) {
  const chunks = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff"
  });
  res.end();
}

async function sendSafeFile(res, baseDir, relativePath) {
  const safePath = resolveSafePath(baseDir, relativePath);
  if (!safePath) {
    return sendJson(res, 403, { error: "Access denied." });
  }

  return sendFile(res, safePath);
}

function resolveSafePath(baseDir, relativePath) {
  const decodedPath = decodeURIComponent(relativePath || "");
  const targetPath = path.resolve(baseDir, decodedPath);
  const normalizedBase = `${path.resolve(baseDir)}${path.sep}`;

  if (targetPath !== path.resolve(baseDir) && !targetPath.startsWith(normalizedBase)) {
    return null;
  }

  return targetPath;
}

async function sendFile(res, filePath, extraHeaders = {}) {
  try {
    const stats = await fsp.stat(filePath);
    if (!stats.isFile()) {
      return sendJson(res, 404, { error: "File not found." });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendJson(res, 404, { error: "File not found." });
    }
    throw error;
  }
}
