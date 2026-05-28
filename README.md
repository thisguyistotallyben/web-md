# WebMD Workspace

An elegant, secure, and modern Markdown wiki and note-taking workspace built with Next.js (App Router), React 19, TipTap Editor, and Redis.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+)
- Redis Server (configured in your local/production environment)

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env.local` file in the root directory:
   ```env
   JWT_SECRET=your-secure-random-passkey
   REDIS_URL=redis://localhost:6379
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000` to start editing.

4. **Production Build**
   To build the production bundle:
   ```bash
   npm run build
   ```

---

## 🚢 Deployment (LXC Containers or VM)

This repository includes a robust automation suite to compile and deploy your Next.js application to a remote target (like an LXC container or a virtual machine).

The deployment process uses two scripts:
- **`deploy.sh`** (runs locally on your machine)
- **`setup-lxc.sh`** (gets packaged, transferred, and executed automatically on the remote machine)

### Option A: Full Setup (First-time Deploy)
Use this option when deploying to a clean, newly-created LXC container. This command builds the project locally, transfers the build artifacts, automatically installs system dependencies (Node.js 20, Nginx, rsync), sets up a systemd service, and configures an Nginx reverse proxy.

```bash
npm run deploy -- user@ip
```
*Example:* `npm run deploy -- root@192.168.1.150`

### Option B: Fast Update (Code Updates Only)
Use this option when you have made code modifications and want to push a quick update. It bypasses systemic dependency checks, builds the project locally, syncs only the code changes, and restarts the existing systemd service.

```bash
npm run deploy -- user@ip --update
```
*Example:* `npm run deploy -- root@192.168.1.150 --update`

---

## 🔧 How It Works Under the Hood

### 1. Local Building & Packaging (`deploy.sh`)
- Builds the application using Next.js standalone output (`next build`), compiling efficient and low-footprint assets.
- Automatically copies assets (`public/`, `.next/static/`) and deployment helpers into `.next/standalone/`.
- Compresses and transfers the standalone bundle to `/tmp` on the target machine using a secure `tar` pipe over SSH.

### 2. Remote Provisioning (`setup-lxc.sh`)
- Installs Node.js 20, Nginx, and `rsync` if they are not already installed on the remote machine.
- Provisions a dedicated directory at `/var/www/web-md/`.
- Deploys a systemd service (`/etc/systemd/system/web-md.service`) configured to auto-restart.
- Configures an Nginx virtual host with reverse proxying from Port 80 to Next.js on Port 3000.
- Reloads Nginx and restarts the service.
