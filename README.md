# 🎉 PartyVote - Self-Hosted Ad-Free Party Voting Platform

A modern, ad-free, self-hosted web application for party hosts to create live contests, display real-time QR codes and guest activity on a TV screen, and allow guests to vote from their mobile devices with single-ballot enforcement.

---

## 🚀 Ubuntu Server Deployment

### Method A: Docker Compose (Command Line)

1. Clone repository to server:
```bash
git clone <your-repo-url> partyvote
cd partyvote
```

2. Build and launch containers:
```bash
docker compose up -d --build
```

Access at `http://<your-ubuntu-ip>:5173`.

---

### Method B: Portainer Stack Deployment

If you use Portainer to manage Docker containers on your Ubuntu server:

#### Step 1: Add New Stack in Portainer
1. Open Portainer dashboard -> Select your environment (e.g. `local`).
2. Go to **Stacks** in the sidebar -> Click **+ Add stack**.
3. Name the stack: `partyvote`.

#### Step 2: Choose Deployment Method

**Option 1: Deploy via Git Repository (Recommended)**
1. Select **Repository**.
2. Paste your repository URL and branch (`main`).
3. Repository reference: `docker-compose.yml`.
4. Click **Deploy the stack**.

**Option 2: Deploy via Web Editor**
1. Select **Web Editor**.
2. Paste the contents of `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=production
      - PORT=5173
      - HOST=0.0.0.0
      - DATABASE_URL=postgres://postgres:partysecret@db:5432/partyvote
    depends_on:
      db:
        condition: service_healthy
    restart: always

  db:
    image: postgres:16-alpine
    container_name: partyvote_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: partysecret
      POSTGRES_DB: partyvote
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: always

volumes:
  pgdata:
```
3. Click **Deploy the stack**.
