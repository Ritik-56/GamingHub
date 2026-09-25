# Gaming Hub

Gaming café management platform — a multi-tenant SaaS for managing gaming stations, sessions, billing, and operations.

## Architecture

```
GamingHUB/
├── server/     # Express API (Node.js, MongoDB)
└── client/     # React SPA (Vite)
```

**Backend** is the source of truth for all business logic, authentication, and authorization.
**Frontend** consumes backend APIs.

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Install all dependencies
npm run install:all

# Copy environment config
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI
```

### Development

Run in separate terminals:

```bash
# Terminal 1 — Backend (port 5000)
npm run dev:server

# Terminal 2 — Frontend (port 5173)
npm run dev:client
```

The frontend proxies `/api` requests to the backend during development.

### Health Check

```bash
curl http://localhost:5000/api/health
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, Mongoose |
| Frontend | React 18, Vite, React Router |
| Database | MongoDB |
| HTTP Client | Axios |
