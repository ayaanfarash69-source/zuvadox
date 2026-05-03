# Zuva Client Portal

This is a standalone website for Zuva Global Mobility Spain where clients can upload their case documents.

## What it does

- Gives clients a polished upload form
- Stores uploaded documents in `uploads/`
- Saves submission details in `data/submissions.json`
- Includes a simple internal team view at `/admin.html`

## Run locally

### Option 1: PowerShell helper

```powershell
.\start-portal.ps1
```

### Option 1b: One-click launchers

Double-click either of these files:

- `open-client-portal.cmd`
- `open-admin-portal.cmd`

### Option 1c: Keep it running after restart/login

- `portal-watchdog.ps1` keeps the local server alive while Windows is running
- `install-local-autostart.ps1` adds that watchdog to your Windows Startup folder
- `remove-local-autostart.ps1` removes the Startup entry

### Option 2: Direct Node command

```powershell
& "$HOME\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\server.js
```

Open `http://localhost:3000`

## Local uptime note

This runs as a local Node server on your computer, so it can appear "offline" later if:

- the computer restarts
- the Node process stops
- the machine sleeps or hibernates

If that happens, just run:

- `open-client-portal.cmd`
- or `open-admin-portal.cmd`

Those launchers start the server again if it is down, wait for it to come online, and then open the site.

## Clearing test submissions

If you want to wipe all stored test submissions and uploaded files, use:

- `clear-all-submissions.ps1`

## Important note

This version stores files locally on the server. Before using it publicly, add:

- Authentication for the team dashboard
- Secure cloud storage or a company document system
- Email notifications or CRM integration if you want every upload pushed to your inbox

## Public deployment

This project now includes:

- Admin login protection for `/admin.html`, `/api/submissions`, and uploaded files
- A health check endpoint at `/health`
- A Render Blueprint file at `render.yaml`
- Configurable storage via `STORAGE_ROOT`, `DATA_DIR`, and `UPLOADS_DIR`

## Local admin credentials

The admin area is intentionally blocked unless credentials are configured.

Use one of these:

- Create `admin-credentials.json` from `admin-credentials.example.json`
- Or set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in the environment

Without credentials configured:

- `/admin.html` redirects to the login page
- `/api/submissions` returns unauthorized
- uploaded client files under `/uploads/...` are not accessible

### Recommended hosted path: Render

Render is a good fit for this app because it gives you:

- A public HTTPS URL
- A Node web service
- A persistent disk for uploaded files

Important:

- Render's docs note that web services are public at an `onrender.com` URL.
- Render's docs also note that filesystem changes are ephemeral by default, so uploaded files need a persistent disk.
- Render's persistent disk docs say only data under the disk mount path is preserved.

### Render steps

1. Put this `zuva-client-portal` folder into a GitHub, GitLab, or Bitbucket repo.
2. Create a Render web service from that repo.
3. Let Render detect `render.yaml`.
4. Set the admin username and password when Render prompts for secret env vars.
5. Deploy the service.
6. Open the public `onrender.com` URL that Render gives you.

### Source notes

- Render web services receive a public `onrender.com` URL:
  [Render Web Services](https://render.com/docs/web-services)
- Render persistent disks preserve local files across deploys and restarts, but only under the mount path:
  [Render Persistent Disks](https://render.com/docs/disks)
- Render Blueprints support `disk`, `buildCommand`, `startCommand`, and secret env vars:
  [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
