# WiselySplit Those Benjamins

A Splitwise-style full-stack expense sharing app scaffold built with:

- React + Vite frontend
- Node.js + Express backend
- MongoDB + Mongoose
- JWT authentication
- Socket.IO realtime balance refresh

## Project structure

- `client/` React app
- `server/` Express API

## Features

- User signup and login with hashed passwords and JWT
- Create shared groups
- Add expenses with equal or custom splits
- Track who owes whom inside a group
- Record settlements
- Dashboard summaries and recent activity
- Realtime balance refresh via Socket.IO

## Quick start

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Update `.env`:

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/sw_clone
JWT_SECRET=replace_this_with_a_long_secret
CLIENT_URL=http://localhost:5173
```

Run:

```bash
npm run dev
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

## Main API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`
- `POST /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/settlements`

## Notes

- The backend recalculates member balances whenever expenses or settlements change.
- Socket.IO emits `group:updated` so connected clients can refresh live.
- This is a solid starter you can expand with notifications, avatars, expense comments, and payment integrations.
