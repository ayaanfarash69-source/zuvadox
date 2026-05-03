ZUVA CLIENT PORTAL

This is a standalone website for Zuva Global Mobility Spain where clients can upload their case documents.

WHAT IT DOES

- Gives clients a polished upload form
- Stores uploaded documents in uploads/
- Saves submission details in data/submissions.json
- Includes a simple internal team view at /admin.html

RUN LOCALLY

Option 1: PowerShell helper

.\start-portal.ps1

Option 1b: One-click launchers

Double-click:

- open-client-portal.cmd
- open-admin-portal.cmd

Option 1c: Keep it running after restart/login

- portal-watchdog.ps1 keeps the local server alive while Windows is on
- install-local-autostart.ps1 adds it to your Windows Startup folder
- remove-local-autostart.ps1 removes that Startup entry

Option 2: Direct Node command

& "$HOME\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\server.js

Then open:
http://localhost:3000

IMPORTANT LOCAL NOTE

This is a local server, so it can go offline after:

- restarting the computer
- closing the server process
- sleep/hibernate in some cases

If that happens, run:

- open-client-portal.cmd
or
- open-admin-portal.cmd

TEST DATA CLEANUP

If you want to wipe all old test submissions and uploaded files, use:

- clear-all-submissions.ps1

IMPORTANT NOTE

This version stores files locally on the server. Before using it publicly, add:

- Authentication for the team dashboard
- Secure cloud storage or a company document system
- Email notifications or CRM integration if you want every upload pushed to your inbox

PUBLIC DEPLOYMENT

This project now includes:

- Admin login protection for /admin.html, /api/submissions, and uploaded files
- A health check endpoint at /health
- A Render deployment file at render.yaml
- Configurable storage through STORAGE_ROOT

LOCAL ADMIN CREDENTIALS

The admin area is blocked unless credentials are configured.

Use one of these:

- Create admin-credentials.json from admin-credentials.example.json
- Or set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET in the environment

Without credentials configured:

- /admin.html redirects to login
- /api/submissions returns unauthorized
- uploaded files are not publicly accessible

RECOMMENDED HOSTED PATH: RENDER

1. Put this zuva-client-portal folder into a GitHub, GitLab, or Bitbucket repo.
2. Create a Render web service from that repo.
3. Let Render use render.yaml.
4. Set the admin username and admin password when prompted.
5. Deploy and use the public onrender.com URL.

Important:

- Render web services get a public URL.
- Render storage is ephemeral by default, so uploaded files need the persistent disk defined in render.yaml.
