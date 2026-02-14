# Testify – Production Readiness

This repository contains:
- Backend: Node.js + Express + MongoDB (in `backend/`)
- Frontend: Static HTML/CSS/JS with Bootstrap (in `Frontend/`)

No business logic or positioning was changed. The following improvements prepare the app for secure, live hosting.

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (Atlas or managed service)
- Razorpay account (test keys for UAT)

### Environment Variables
Create `backend/.env` using `backend/.env.example`:

```
PORT=5000
MONGO_URI=mongodb+srv://<USER>:<PASSWORD>@cluster0.mongodb.net/<DB_NAME>?retryWrites=true&w=majority
JWT_SECRET=<YOUR_JWT_SECRET>
RAZORPAY_KEY_ID=rzp_test_<YOUR_KEY_ID>
RAZORPAY_KEY_SECRET=<YOUR_KEY_SECRET>
RAZORPAY_WEBHOOK_SECRET=<YOUR_WEBHOOK_SECRET>
CORS_ORIGINS=https://your-frontend.example.com,https://staging-frontend.example.com
NODE_ENV=production
```

### Install

```
cd backend
npm install
```

## Run

### Development

```
cd backend
npm start
```
Backend listens on `PORT` and exposes `/api/health`.

Serve the frontend locally:
```
node server.js
```
The static server serves files from `Frontend/` on `http://localhost:8080/`.

## Deployment

### Backend (Render / Railway / AWS / DO)
- Build: none (Node.js runtime)
- Start command: `node server.js` (from `backend/`)
- Health check: `GET /api/health`
- Required env: see above
- CORS: set `CORS_ORIGINS` to your frontend domains
- Webhook: set a Razorpay webhook to `POST /api/payment/webhook`

Graceful shutdown and connection retry are enabled.

### Frontend (Netlify / Vercel / GitHub Pages)
- Publish directory: `Frontend/`
- API base URL:
  - Set localStorage key `api_base_url` to your backend base (e.g., `https://api.example.com/api`)
  
Google Maps: Store key in `localStorage gm_api_key` or serve from backend `/api/config/maps-key/raw` for controlled environments.

## Security & Hardening Highlights
- Helmet defaults enabled
- CORS restricted via `CORS_ORIGINS`
- Body size limits for JSON and uploads
- Rate limiting on `/api/auth` and `/api/payment`
- Razorpay webhook uses raw body for signature verification
- Multer PDF upload limits and sanitized filenames
- Input validation for auth routes (express-validator)
- Mongoose indexes for frequent queries
- Graceful shutdown and DB connection retry

## Smoke Test Checklist
- `GET /api/health` returns `{ status: 'ok' }`
- Register/login flows work
- Booking create and provider accept/complete work
- Payment test mode:
  - Create order
  - Complete a test payment
  - Verify endpoint confirms booking
  - Webhook updates payment status
- Report upload accepts PDF <= 5MB

## Repo Hygiene
- `.gitignore` excludes secrets and uploads
- `backend/.env.example` provided

## Notes
- Socket.IO not present; namespaces/auth can be added later if real-time tracking is introduced
- No medical claims are made; legal pages are present and linked in footer

