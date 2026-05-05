# Fly.io Deployment Guide

This guide walks through deploying the PDF library on Fly.io with a persistent volume so your uploaded PDFs and library database survive restarts and redeployments.

## Prerequisites

- A [Fly.io account](https://fly.io) (free to create, no credit card required for signup but you will need one to create a volume)
- Git repository with your code pushed to GitHub (or any remote) — not strictly required but recommended

---

## Step 1 — Install the Fly CLI (`flyctl`)

On Linux/macOS, run:

```bash
curl -L https://fly.io/install.sh | sh
```

Then add it to your PATH if the installer prompts you to. Verify it works:

```bash
fly version
```

On Windows, use the installer from https://fly.io/docs/flyctl/install/

---

## Step 2 — Log in to Fly

```bash
fly auth login
```

This opens a browser window. Log in or create your account there.

---

## Step 3 — Create a Dockerfile

Fly deploys your app as a Docker container. Create a file named `Dockerfile` in the root of the project (next to `package.json`):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

Then open `next.config.ts` and add `output: "standalone"` so Next.js produces a self-contained server bundle:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

---

## Step 4 — Create a `.dockerignore` file

Create `.dockerignore` in the project root to keep the image small:

```
node_modules
.next
.git
local-files
data
.env
.env.local
```

---

## Step 5 — Launch the app on Fly

From the project root, run:

```bash
fly launch
```

Fly will ask you several questions:

- **App name:** Pick anything unique, e.g. `my-pdf-library`. This becomes part of your URL: `https://my-pdf-library.fly.dev`
- **Region:** Pick the region closest to you. Common choices: `ord` (Chicago), `iad` (Virginia), `lhr` (London), `nrt` (Tokyo)
- **Would you like to set up a PostgreSQL database?** → **No**
- **Would you like to set up an Upstash Redis database?** → **No**
- **Would you like to deploy now?** → **No** (you need to add the volume first)

This creates a `fly.toml` file in your project root.

---

## Step 6 — Edit `fly.toml`

Open the generated `fly.toml`. It will look something like this — make sure these sections exist and match:

```toml
app = "my-pdf-library"   # whatever name you chose
primary_region = "ord"   # whatever region you chose

[build]

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1

[[mounts]]
  source = "pdf_library_data"
  destination = "/app/local-files"
  initial_size = "10gb"
```

The `[[mounts]]` section is the key part — it tells Fly to attach a persistent volume at `/app/local-files`, which is where the app stores all uploaded PDFs.

> **Note on `auto_stop_machines`:** Setting this to `"stop"` means the machine sleeps when no one is using it (saves cost). The first request after a sleep takes ~2-3 seconds to wake up. If you want it always-on, change it to `"off"` (costs more).

---

## Step 7 — Create the persistent volume

Run this command, replacing `ord` with the same region you chose in Step 5:

```bash
fly volumes create pdf_library_data --region ord --size 10
```

- `--size 10` means 10 GB. Adjust as needed (you can expand later).
- The volume name `pdf_library_data` must match the `source` in `fly.toml`.

---

## Step 8 — Set your secret environment variables

The app needs a password and a session secret. Set them as Fly secrets (they are encrypted and injected as environment variables at runtime — never put them in `fly.toml`):

```bash
fly secrets set PDF_LIBRARY_PASSWORD="choose-a-strong-password"
fly secrets set PDF_LIBRARY_SESSION_SECRET="paste-at-least-32-random-characters-here"
```

To generate a strong session secret you can run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as your `PDF_LIBRARY_SESSION_SECRET`.

---

## Step 9 — Deploy

```bash
fly deploy
```

Fly will build the Docker image, push it, and start the machine. The first deploy takes 2-4 minutes. You'll see build output in your terminal.

When it finishes, run:

```bash
fly status
```

You should see your machine listed as `started`.

---

## Step 10 — Open the app

```bash
fly open
```

This opens `https://your-app-name.fly.dev` in your browser. Log in with the password you set in Step 8.

You can now upload PDFs from any browser on any machine by visiting that URL.

---

## Where your data lives

| What | Where on disk | Persisted? |
|---|---|---|
| Uploaded PDFs | `/app/local-files/documents/` | Yes — on the Fly volume |
| Library database | `/app/data/library.json` | **No** — see note below |

**Important:** The `data/` directory (which holds `library.json`) is inside `/app` but is NOT under `/app/local-files`, so it is not on the persistent volume. This means your library metadata (titles, bookmarks, annotations) is reset on each deploy.

To fix this, add a second mount in `fly.toml`:

```toml
[[mounts]]
  source = "pdf_library_data"
  destination = "/app/local-files"
  initial_size = "10gb"

[[mounts]]
  source = "pdf_library_db"
  destination = "/app/data"
  initial_size = "1gb"
```

Then create the second volume:

```bash
fly volumes create pdf_library_db --region ord --size 1
```

Then redeploy:

```bash
fly deploy
```

---

## Ongoing operations

### View live logs
```bash
fly logs
```

### SSH into the running machine
```bash
fly ssh console
```

### Redeploy after code changes
```bash
fly deploy
```

### Check how much of your volume is used
```bash
fly ssh console -C "df -h /app/local-files"
```

### Expand a volume if you run out of space
```bash
fly volumes extend <volume-id> --size 20
```

Get the volume ID from `fly volumes list`.

---

## Estimated monthly cost

- Machine (1 shared CPU, 1 GB RAM, auto-stop): ~$0–5/month depending on usage
- Volume storage: $0.15/GB/month → 10 GB = $1.50/month, 11 GB = $1.65/month
- Outbound data transfer: $0.02/GB (PDFs served to your browser)

For personal use expect **$2–5/month total**.
