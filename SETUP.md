# GitMesh Agents: Complete Setup Guide

This guide walks you through three methods to get GitMesh Agents running: **Local Development**, **Docker Compose**, and **Docker CLI**.

---

## Prerequisites (All Methods)

- **Git** (to clone the repo)
- **4GB RAM minimum** (8GB recommended)
- **10GB free disk space**

---

## Method 1: Local Development (Recommended for Developers)

Best for local development, debugging, and code changes.

### Requirements
- Node.js 20+ ([download](https://nodejs.org))
- pnpm 9+ (install with `npm install -g pnpm`)

### Steps

1. **Clone and enter the repo:**
   ```bash
   git clone https://github.com/LF-Decentralized-Trust-labs/gitmesh.git
   cd gitmesh
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Reset database (first time only):**
   ```bash
   rm -rf ~/.gitmesh-agents/instances/default/db
   ```

4. **Start the development server:**
   ```bash
   pnpm dev
   ```

   Or use the one-command bootstrap (includes auto-setup):
   ```bash
   pnpm gitmesh-agents run
   ```

5. **Access the application:**
   - Open `http://localhost:3100` in your browser
   - API available at `http://localhost:3100/api`

**Verification:**
```bash
curl http://localhost:3100/api/health
```

### Development Commands

```bash
pnpm dev                    # API + UI in watch mode
pnpm dev:once              # single run, no file watching
pnpm dev:server            # only API server
pnpm dev:ui                # only UI (port 3100)
pnpm -r typecheck          # type checking
pnpm test:run              # run all tests
pnpm build                 # production build
```

### Troubleshooting

**Error: `ECONNREFUSED 127.0.0.1:5433`**
```bash
# Embedded PostgreSQL will auto-start. If you see connection errors:
rm -rf ~/.gitmesh-agents/instances/default/db
unset DATABASE_URL
pnpm dev
```

**Error: Missing module `@gitmesh/adapter-sdk`**
```bash
# Rebuild dependencies
pnpm install --no-frozen-lockfile
pnpm -r build
pnpm dev
```

---

## Method 2: Docker Compose (Easiest Docker Setup)

Recommended for one-command Docker deployment.

### Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+

### Steps

1. **Clone the repo:**
   ```bash
   git clone https://github.com/LF-Decentralized-Trust-labs/gitmesh.git
   cd gitmesh
   ```

2. **Start with Compose:**
   ```bash
   docker compose -f docker-compose.quickstart.yml up --build
   ```

   First build takes ~2-3 minutes. Subsequent runs are faster.

3. **Access the application:**
   - Open `http://localhost:3100` in your browser

4. **Verify it's running:**
   ```bash
   curl http://localhost:3100/api/health
   ```

### Optional Configuration

**Change port:**
```bash
GITMESH_PORT=3200 docker compose -f docker-compose.quickstart.yml up --build
```

**Add API keys (Claude + OpenAI):**
```bash
OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... \
  docker compose -f docker-compose.quickstart.yml up --build
```

**Use external URL (for remote access):**
```bash
GITMESH_PUBLIC_URL=https://agents.example.com \
  docker compose -f docker-compose.quickstart.yml up --build
```

### Data Persistence

- All data stored in: `./data/docker-gitmesh-agents`
- Database, uploads, and secrets are preserved across container restarts
- To reset: `rm -rf ./data/docker-gitmesh-agents`

### Stop the Container

```bash
docker compose -f docker-compose.quickstart.yml down
```

---

## Method 3: Docker CLI (Manual Docker Setup)

For granular control over Docker configuration.

### Requirements
- Docker Engine 20.10+

### Steps

1. **Clone the repo:**
   ```bash
   git clone https://github.com/LF-Decentralized-Trust-labs/gitmesh.git
   cd gitmesh
   ```

2. **Build the image:**
   ```bash
   docker build -t gitmesh-agents-local .
   ```

   First build takes ~2-3 minutes.

3. **Run the container:**
   ```bash
   docker run --name gitmesh-agents \
     -p 3100:3100 \
     -e HOST=0.0.0.0 \
     -e GITMESH_HOME=/gitmesh-agents \
     -v "$(pwd)/data/docker-gitmesh-agents:/gitmesh-agents" \
     gitmesh-agents-local
   ```

4. **Access the application:**
   - Open `http://localhost:3100` in your browser

### Optional: Run with API Keys

```bash
docker run --name gitmesh-agents \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e GITMESH_HOME=/gitmesh-agents \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  -v "$(pwd)/data/docker-gitmesh-agents:/gitmesh-agents" \
  gitmesh-agents-local
```

### Stop the Container

```bash
docker stop gitmesh-agents
docker rm gitmesh-agents
```

### Clean Up

```bash
# Remove image
docker rmi gitmesh-agents-local

# Remove persisted data
rm -rf ./data/docker-gitmesh-agents
```

---

## Quick Reference: Which Method Should I Use?

| Use Case | Method | Time |
|----------|--------|------|
| Local development / debugging | Local Dev | ~5 min |
| Quick Docker test | Docker Compose | ~3 min |
| Production / CI-CD | Docker CLI or Compose | ~3 min |
| Headless / server only | Docker | N/A |

---

## Post-Setup Configuration

### 1. Create Your First Project

1. Open `http://localhost:3100`
2. Click "New Project"
3. Enter your GitHub repository URL
4. Configure webhooks (GitHub → Settings → Webhooks)

### 2. Add API Keys (Optional)

For agent adapters to work:

**Local Dev:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
pnpm dev
```

**Docker:**
```bash
# Pass at container startup (see Method 2/3 above)
docker run ... -e ANTHROPIC_API_KEY=... -e OPENAI_API_KEY=... ...
```

### 3. Configure Agents

In the UI or via CLI:
```bash
pnpm gitmesh-agents agent create \
  --project-id <id> \
  --name "Issue Triage" \
  --role triage
```

---

## Verification Commands

**Health check:**
```bash
curl http://localhost:3100/api/health
```

Expected response:
```json
{"status":"ok"}
```

**List projects:**
```bash
curl http://localhost:3100/api/projects
```

---

## Logs and Debugging

### Local Dev

```bash
# Watch logs in real-time
pnpm dev

# Check database status
ls -la ~/.gitmesh-agents/instances/default/db
```

### Docker

```bash
# View container logs
docker logs gitmesh-agents

# Tail logs in real-time
docker logs -f gitmesh-agents

# Access container shell
docker exec -it gitmesh-agents bash
```

---

## Common Issues and Fixes

### Issue: Port 3100 Already in Use

**Local Dev:**
```bash
# Kill process on port 3100
lsof -ti:3100 | xargs kill -9

# Or use a different port (requires code change)
```

**Docker:**
```bash
# Use different port
docker run -p 3200:3100 ... gitmesh-agents-local
```

### Issue: Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up unused images/containers
docker system prune -a
```

### Issue: Database Locked

```bash
# Local Dev
rm -rf ~/.gitmesh-agents/instances/default/db
pnpm dev

# Docker
docker stop gitmesh-agents
rm -rf ./data/docker-gitmesh-agents
docker run ... gitmesh-agents-local
```

### Issue: TypeScript Errors During Build

```bash
# Local Dev
pnpm install --no-frozen-lockfile
pnpm -r build
pnpm dev

# Docker
docker build --no-cache -t gitmesh-agents-local .
```

---

## Next Steps

1. **Read the documentation:** [doc/GOAL.md](doc/GOAL.md) and [doc/v1-spec.md](doc/v1-spec.md)
2. **Explore the playbooks:** [playbooks/](playbooks/) directory
3. **Set up your first agent:** See Post-Setup Configuration above
4. **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/LF-Decentralized-Trust-labs/gitmesh/issues)
- **Docs:** [doc/](doc/) directory
- **Developing:** [doc/DEVELOPING.md](doc/DEVELOPING.md)
- **Database:** [doc/DATABASE.md](doc/DATABASE.md)

