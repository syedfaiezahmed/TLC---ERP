# TLC ERP Suite

Full-stack Coaching Institute Management System — MERN Stack (MongoDB, Express 5, React, Node.js)

## Project Structure

```
TLC/Software/
├── client/          # React frontend (Vite)
├── server/          # Express backend (Node.js)
├── package.json     # Root scripts (concurrently)
└── vercel.json      # Deployment config
```

## Quick Start (Development)

### Prerequisites
- Node.js >= 18
- MongoDB Atlas (configured in server/.env)

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Run both servers concurrently
```bash
npm run dev
```
- **Frontend**: http://localhost:5173 (Vite dev server with HMR)
- **Backend API**: http://localhost:5000/api

### 3. Run individually
```bash
npm run server    # Backend only (port 5000)
npm run client    # Frontend only (port 5173)
```

## Environment Variables

### server/.env
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
ENABLE_BACKUP_SCHEDULER=false
```

### client/.env (optional — leave empty for dev)
```
# Leave blank to use Vite proxy (/api → localhost:5000)
VITE_API_URL=
```

## Production Build
```bash
npm run build        # Builds client/dist
npm start            # Serves React app + API from port 5000
```

## Architecture

- **Frontend** (port 5173 in dev): Vite proxies `/api/*` → Express on port 5000
- **Backend** (port 5000): Express 5 REST API + MongoDB
- **Production**: Express serves built React app as static files + all API routes
- **Auth**: JWT Bearer tokens stored in localStorage
- **Accounting**: Double-entry bookkeeping via Ledger collection
