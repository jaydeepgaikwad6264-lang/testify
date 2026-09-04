# Testify – Production Readiness & Hosting Guide

This repository contains:
- **Backend**: Node.js + Express 5 + MongoDB (in `backend/`)
- **Frontend**: Static HTML/CSS/JS with Bootstrap 5 (in `Frontend/`)
- **Services**: Razorpay payments, MessageCentral OTP, Google Maps integration
- **Architecture**: Stateless REST API with JWT authentication, static frontend deployable on any CDN

---

## Project Structure Review

### Backend Overview (`backend/`)
**Key Strengths:**
- [server.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/server.js) — MongoDB connection with auto-retry (5 attempts, 2s delay), graceful SIGINT/SIGTERM shutdown, startup env validation
- [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js) — Helmet security headers, CORS origin whitelisting, express-rate-limit on auth/payment endpoints, 1MB body size limits
- [error.middleware.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/middleware/error.middleware.js) — Production-safe error handling (hides stack traces, generic 500 messages)
- [auth.middleware.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/middleware/auth.middleware.js) — JWT Bearer token verification, user injection into requests
- **Validation**: express-validator on all auth routes in [auth.routes.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/routes/auth.routes.js)

**API Endpoints:**
| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Register, login, OTP send/verify, profile (rate-limited) |
| `/api/bookings` | Create, fetch user/provider bookings, status transitions |
| `/api/provider` | Provider profile, wallet, services, online status |
| `/api/payment` | Razorpay order create, verify, webhook (rate-limited) |
| `/api/location` | Provider live location updates |
| `/api/report` | PDF report uploads (Multer, 5MB limit) |
| `/api/services` | Service catalog (BP, Sugar, Combo) |
| `/api/config` | Google Maps key endpoint |
| `/api/admin` | Admin dashboard operations |
| `/api/health` | Health check → `{ status: 'ok' }` |

### Frontend Overview (`Frontend/`)
**Key Files:**
- [main.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/main.js) — Global `CONFIG` with smart API base URL detection (auto-switches to `localhost:5000` for private networks, defaults to Render backend otherwise)
- [auth.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/auth.js) — localStorage-based token persistence, login/register/OTP flows
- [provider.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/provider.js) — Provider dashboard with 5s request polling, 60s location sync, visibility-aware refresh
- [booking.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/booking.js) — Booking flow with Google Places autocomplete, map marker, service pricing
- [vercel.json](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/vercel.json) — Pre-configured Vercel routing with security headers (HSTS, X-Frame-Options, Referrer-Policy, Cache-Control for assets)

**Smart API URL Detection (built-in):**
- Private networks (`localhost`, `192.168.*`, `10.*`, `172.16-31.*`) → `http://<host>:5000/api`
- Everything else → `https://testify-backend-vhjp.onrender.com/api` (default; override by editing `CONFIG.apiBaseUrl` in [main.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/main.js#L7))

---

## Prerequisites

| Component | Minimum Version | Purpose |
|-----------|-----------------|---------|
| Node.js | 18.x+ | Backend runtime (Express 5 requires Node 18+) |
| npm | 9.x+ | Package manager (bundled with Node) |
| MongoDB | Atlas M0 (free tier) or self-hosted | Primary database |
| Razorpay Account | Test/Live mode keys | Payment processing (INR) |
| MessageCentral Account (optional) | Auth Token + Customer ID | SMS OTP delivery |
| Google Maps API Key | With Places API enabled | Location autocomplete, maps |

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and fill these values. **All variables marked required will crash startup if missing in production.**

```ini
# ===== REQUIRED IN PRODUCTION =====
PORT=5000                                            # Server port (Render/Railway auto-set this)
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=<min-32-char-random-string-use-openssl-rand>
CORS_ORIGINS=https://your-app.vercel.app,https://your-app.netlify.app,http://localhost:8080
NODE_ENV=production                                  # Set to "production" for security hardening

# ===== REQUIRED FOR PAYMENTS =====
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx              # Or rzp_test_ for sandbox
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx             # Razorpay dashboard → Settings → API Keys
RAZORPAY_WEBHOOK_SECRET=<generate-random-webhook-secret>

# ===== REQUIRED FOR SMS OTP =====
MESSAGECENTRAL_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxx       # MessageCentral dashboard
MESSAGECENTRAL_CUSTOMER_ID=xxxxxxxxx

# ===== OPTIONAL =====
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxx          # Required for Maps UI; fallback: served via localStorage
TRUST_PROXY=1                                        # For deployments behind reverse proxies (Render, Railway, Nginx)
JWT_EXPIRES_IN=7d                                    # Token expiry (default: 7 days)
```

**Generate secure secrets (Linux/macOS/PowerShell):**
```bash
# JWT_SECRET (32+ chars)
openssl rand -base64 48

# Razorpay Webhook Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Local Development Setup

### 1. Backend

```bash
# Install dependencies
cd backend
npm install

# Create & configure .env
cp .env.example .env   # PowerShell: copy .env.example .env
# → Edit .env with your MongoDB URI, secrets, etc.

# Optional: Seed database with default services & test users
npm run seed

# Start backend (runs on http://localhost:5000)
npm start
```

Health check:
```
GET http://localhost:5000/api/health
→ Expected: { "status": "ok" }
```

### 2. Frontend

No build step required — it's pure static HTML/CSS/JS. Serve with any static server:

```bash
# Option A: Python built-in
cd Frontend
python -m http.server 8080

# Option B: Node http-server
npx http-server Frontend -p 8080 -c-1

# Option C: If you have a server.js at root
node server.js   # Serves Frontend/ on http://localhost:8080
```

Open `http://localhost:8080` in your browser. The frontend will automatically call the backend at `http://localhost:5000/api` (thanks to private-network detection in [main.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/main.js#L11-L22)).

---

## Deployment Guides

---

### Option A: Vercel (Frontend + Backend) — Recommended for simplicity

Vercel hosts the **frontend via its static CDN** and can proxy API calls. For backend, use a Node-compatible host alongside.

#### Frontend on Vercel

1. Push repository to GitHub/GitLab/Bitbucket
2. Import project into Vercel → **Configure Project**
3. **Framework Preset**: `Other`
4. **Build Command**: *(leave empty — no build step)*
5. **Output Directory**: `Frontend`
6. **Root Directory**: *(leave as repo root)*
7. Deploy → Done! ✅

The included [vercel.json](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/vercel.json) auto-configures:
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- 1-year immutable cache for `/assets/*`
- Clean URL routing (`/about` → `/Frontend/public/about/index.html`)

#### Backend on Render (recommended pairing with Vercel)

Render provides free-tier Node hosting.

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your repo
3. Configure:
   - **Name**: `testify-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Start with `Free` (upgrades needed for production traffic)
4. Go to **Environment** tab → add all `.env` variables (see above)
5. **Advanced**: Set **Health Check Path** → `/api/health`
6. Deploy → backend runs at `https://testify-backend-xxx.onrender.com`

**Connect frontend to backend:** Edit `CONFIG.apiBaseUrl` in [main.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/main.js#L7) to your Render URL:
```javascript
apiBaseUrl: runtimeConfig.apiBaseUrl || 'https://testify-backend-xxx.onrender.com/api',
```

Redeploy Vercel frontend for changes to take effect.

---

### Option B: Netlify (Frontend) + Railway (Backend)

#### Frontend on Netlify

1. `npm install -g netlify-cli` (or use web UI)
2. Create `netlify.toml` at repo root:
   ```toml
   [build]
   publish = "Frontend"
   
   [[headers]]
     for = "/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   
   [[headers]]
     for = "/*"
     [headers.values]
       X-Frame-Options = "DENY"
       X-Content-Type-Options = "nosniff"
       Referrer-Policy = "strict-origin-when-cross-origin"
       Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
   ```
3. Deploy:
   ```bash
   netlify login
   netlify deploy --prod --dir=Frontend
   ```

#### Backend on Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. From repo root:
   ```bash
   railway login
   railway init
   cd backend
   railway up
   railway add   # Add MongoDB plugin (auto-provisions + sets MONGO_URI)
   railway variables set JWT_SECRET="<your-secret>"
   railway variables set NODE_ENV=production
   railway variables set CORS_ORIGINS="https://<your-netlify-site>.netlify.app"
   railway variables set ... (all remaining env vars)
   ```
3. Railway auto-assigns a public URL. Update frontend `CONFIG.apiBaseUrl` accordingly.

---

### Option C: Self-Hosted (VPS + Nginx + PM2) — For full control

#### Server Setup (Ubuntu 22.04 LTS)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (using Nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MongoDB (optional — use Atlas for easier management)
# OR connect to MongoDB Atlas via MONGO_URI

# Install PM2 process manager
sudo npm install -g pm2

# Clone app
git clone <your-repo> /var/www/testify
cd /var/www/testify/backend
npm install

# Configure environment
cp .env.example .env
nano .env   # Fill all values

# Start backend with PM2
pm2 start server.js --name testify-backend
pm2 save
pm2 startup systemd   # Enables auto-start on reboot
```

#### Nginx Reverse Proxy + Static Frontend

```nginx
# /etc/nginx/sites-available/testify
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;

    # Frontend (static files)
    location / {
        root /var/www/testify/Frontend;
        try_files $uri $uri/ $uri.html =404;
        
        # Security headers (copy from vercel.json)
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # Long-lived cache for assets
    location /assets/ {
        root /var/www/testify/Frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Uploaded reports (served by backend static middleware)
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
    }
}
```

Enable site + install SSL via Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/testify /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

PM2 useful commands:
```bash
pm2 status            # Check running processes
pm2 logs backend      # Tail logs
pm2 restart backend   # Restart after updates
pm2 monit             # Live CPU/memory monitor
```

---

### Option D: AWS S3 (Frontend) + EC2/Elastic Beanstalk (Backend)

#### Frontend on S3 + CloudFront

```bash
# 1. Create S3 bucket (disable "Block all public access" for static hosting)
aws s3 mb s3://testify-frontend --region ap-south-1

# 2. Upload static files
aws s3 sync Frontend/ s3://testify-frontend/ \
  --cache-control "public, max-age=0" \
  --exclude "assets/*"
aws s3 sync Frontend/assets/ s3://testify-frontend/assets/ \
  --cache-control "public, max-age=31536000, immutable"

# 3. Enable static website hosting in AWS Console → S3 → Properties
# 4. Create CloudFront distribution pointing to the S3 website endpoint
# 5. Configure CloudFront Response Headers Policy for security (HSTS, X-Frame, etc.)
```

#### Backend on Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

cd backend
eb init testify-backend --platform node.js-20 --region ap-south-1
eb create testify-prod --single --cname testify-backend
eb setenv MONGO_URI=... JWT_SECRET=... NODE_ENV=production ...
eb deploy
```

---

## Post-Deployment Configuration

### 1. Razorpay Webhook Setup

1. Go to Razorpay Dashboard → **Settings** → **Webhooks** → **Add New Webhook**
2. **Webhook URL**: `https://<your-backend-domain>/api/payment/webhook`
3. **Secret**: Enter the `RAZORPAY_WEBHOOK_SECRET` value from your `.env`
4. **Active Events** (select all):
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
5. Click **Create Webhook**
6. From the Webhooks list, note the **Webhook Secret** → confirm it matches `RAZORPAY_WEBHOOK_SECRET`

### 2. Seed the Database (First Time)

If you deployed on Render/Railway/VPS:
```bash
# Run once from backend directory (ensure MONGO_URI is set)
npm run seed
```
This creates default services (BP Check ₹79, Sugar Check ₹79, Combo Check ₹109) and an admin user.

### 3. Google Maps API Key

Choose **one** approach:
- **Backend-controlled (recommended)**: Set `GOOGLE_MAPS_API_KEY` in backend `.env` → frontend auto-fetches from `/api/config/maps-key/raw`
- **Per-user/dev fallback**: Browser console → `localStorage.setItem('gm_api_key', 'YOUR_KEY')`
- **Hardcoded**: Edit `CONFIG.googleMapsApiKey` in [main.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/main.js#L8)

Enable these in Google Cloud Console → APIs & Services:
- Maps JavaScript API
- Places API (required for address autocomplete)
- Geocoding API (optional, for reverse geocoding)

### 4. MessageCentral OTP

1. Register at [MessageCentral](https://www.messagecentral.in/)
2. Get `Customer ID` + `Auth Token` from dashboard
3. Set in `.env`: `MESSAGECENTRAL_AUTH_TOKEN` + `MESSAGECENTRAL_CUSTOMER_ID`
4. Configure DLT template IDs as required by TRAI regulations in [otpService.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/utils/otpService.js)

### 5. Custom Domain & SSL

All managed platforms (Vercel, Netlify, Render, Railway) provide free auto-renewing Let's Encrypt SSL.
- Go to platform dashboard → **Settings** → **Domains**
- Add your domain → Follow DNS instructions (CNAME records)
- Wait for propagation → SSL is auto-provisioned

---

## Smoke Test Checklist (Post-Deployment)

Run these against your live URLs to confirm everything works:

```bash
# 1. Backend Health
curl -i https://api.yourdomain.com/api/health
→ 200 OK { "status": "ok" }

# 2. CORS (from browser DevTools console on your frontend domain)
fetch('https://api.yourdomain.com/api/health').then(r=>r.json()).then(console.log)
→ Should NOT show CORS error; returns { status: 'ok' }

# 3. MongoDB connectivity
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test","phone":"9876543210","password":"test123","role":"user"}'
→ 201 Created with token

# 4. Rate limiting (run 25x in 15m)
→ 429 Too Many Requests on attempt ~21 for auth endpoints
```

**Full manual flow to validate:**
1. Register a customer (phone + password) on `/register.html`
2. Register a provider on `/register.html?role=provider` → complete profile on `/provider-profile.html`
3. Login to admin (`/admin/index.html`) → Approve the provider
4. As customer on `/booking.html`: Complete booking + Razorpay payment (use test card `4111 1111 1111 1111`, any future exp, any CVV)
5. As provider on `/provider-dashboard.html`: See pending request → Accept → Mark On The Way → Complete
6. Verify payment status updated on `/user-dashboard.html`
7. Provider upload PDF report from completed booking (max 5MB)

---

## Security Hardening Summary

| Layer | Mechanism | File |
|-------|-----------|------|
| **HTTP Headers** | Helmet defaults + cross-origin resource policy | [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js#L15-L17) |
| **CORS** | Whitelist-only in production; dev allows localhost/file:// | [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js#L23-L38) |
| **Auth** | JWT (HS256), Bearer scheme, 7-day expiry, 32+ char secret enforced | [auth.middleware.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/middleware/auth.middleware.js), [server.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/server.js#L17-L19) |
| **Passwords** | bcryptjs (auto-salt rounds via Mongoose pre-save) | [User.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/models/User.js) |
| **Rate Limits** | Auth: 20 req/15min/IP; Payment: 30 req/15min/IP | [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js#L45-L56) |
| **Payload Limits** | JSON/URL-encoded bodies → 1MB cap | [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js#L41-L42) |
| **File Uploads** | Multer 5MB PDF-only; sanitized filenames via upload middleware | [upload.middleware.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/middleware/upload.middleware.js) |
| **Input Validation** | express-validator on register/login/OTP/profile | [auth.routes.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/routes/auth.routes.js) |
| **Error Leakage** | Stack traces hidden in production; generic 500 message | [error.middleware.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/middleware/error.middleware.js#L6-L10) |
| **Payments** | Razorpay webhook signature verified against raw body | [payment.controller.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/controllers/payment.controller.js) |
| **Resilience** | MongoDB 5× reconnect retry (2s backoff) + graceful SIGINT/SIGTERM shutdown | [server.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/server.js#L27-L76) |
| **Frontend** | HSTS, X-Frame DENY, nosniff, Referrer-Policy (via Vercel/Netlify/Nginx) | [vercel.json](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/vercel.json#L3-L18) |
| **X-Powered-By** | Disabled (`app.disable('x-powered-by')`) | [app.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/app.js#L11) |

---

## Troubleshooting Deployment

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Backend crashes immediately | Missing `MONGO_URI` or `JWT_SECRET` | Check Render/Railway Environment Variables; ensure `JWT_SECRET` ≥ 32 chars |
| CORS errors in browser | `CORS_ORIGINS` doesn't include frontend domain | Add exact origin (no trailing slash!) to `CORS_ORIGINS` env var; restart backend |
| JWT "invalid signature" | `JWT_SECRET` changed after users logged in | Tell users to re-login (tokens are signed with old secret) |
| Razorpay webhook 400 | Webhook secret mismatch | Re-verify secret in Razorpay dashboard matches `RAZORPAY_WEBHOOK_SECRET` |
| Google Maps shows "For Development Purposes Only" | API key missing or Places API not enabled | Set key via `.env` + enable Maps JavaScript & Places APIs in GCP |
| OTP SMS not delivered | MessageCentral credentials invalid or DLT not configured | Check MESSAGECENTRAL_* env vars + TRAI DLT template registration |
| Render free tier "spinner" / slow first request | Free instances sleep after 15min idle | Upgrade to paid plan or use uptime-robot.com to ping `/api/health` every 10min |
| Provider bookings not showing | Earlier bug fix: `getProviderBookings` now returns ALL assigned (not filtered) | Ensure you're running latest code; status filter is UI-only in provider.js |
| `node server.js` at root fails | No `server.js` at repo root (that's backend/server.js) | `cd backend && npm start` or use a static server for Frontend/ |

---

## Repo Hygiene

- [.gitignore](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/.gitignore) excludes: `node_modules/`, `backend/.env`, `backend/uploads/`, npm/yarn logs, build artifacts
- [backend/.env.example](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/backend/.env.example) provided as template
- **Never commit** `backend/.env` or any file containing `RAZORPAY_KEY_SECRET` / `JWT_SECRET` / API keys

## Notes

- **Real-time**: Socket.IO is not currently wired. Provider dashboard polls every 5s (see [provider.js](file:///c:/Users/Jaydeep/Downloads/testify-main%20(2)/testify-main/Frontend/assets/js/provider.js#L1)) — acceptable for small user bases; add Socket.IO later if scale requires push-based updates.
- **Legal Pages**: Privacy policy, terms, refund policy, medical disclaimer, provider policy, about, and contact pages are present under `Frontend/public/` and linked in footers. No medical diagnosis claims are made by the platform itself.
- **Uploads**: Provider PDF reports are stored on-disk in `backend/uploads/`. For production, replace with S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2) in the report upload controller for durability.

