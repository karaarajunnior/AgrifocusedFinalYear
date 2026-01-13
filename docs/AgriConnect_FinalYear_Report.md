# AgriConnect (Final Year Project) — Full System Report (Frontend + Backend)

## 1) Executive summary (what this system is)

**AgriConnect** is a **mobile-first agricultural marketplace** that connects **verified farmers** and **buyers**, supports **UGX Airtel Money** payments, improves accessibility using **voice-first UX**, and strengthens trust with **anti-middleman signals** (Trust Score), **proof-of-delivery**, **traceability timelines**, and **auditability** (ledger + optional blockchain anchoring).

The system is built as a complete end-to-end application:
- **Frontend**: React (Vite) + Tailwind UI, optimized for mobile usage.
- **Backend**: Node.js + Express REST API + Socket.IO for real-time chat.
- **Database**: MySQL + Prisma ORM.
- **Payments**: Airtel Money Uganda integration with webhooks and ledger posting.
- **Notifications**: SMS + WhatsApp via Twilio (Firebase not required).

## 2) Problem statement (why it matters)

Agricultural supply chains often face:
- **Middlemen/third parties** reducing farmer profit and increasing buyer prices.
- **Low digital literacy** among rural farmers.
- **Connectivity constraints** (offline/low-network areas).
- **Disputes** around delivery/payment and lack of audit trails.
- Lack of **trust** signals to validate genuine buyers and sellers.

AgriConnect addresses these by combining:
- **verification + trust scoring**
- **offline-first and SMS fallback**
- **proof-of-delivery** to reduce disputes
- **ledger/accounting auditability**
- **traceability timeline** for product batches (food safety/export readiness)

## 3) Technology stack (what I used)

### Frontend (Mobile-first Web App)
- **React + TypeScript** (Vite)
- **Tailwind CSS** for UI
- **Axios** for API calls
- **Socket.IO client** for real-time chat
- **Web Speech API** for voice input (where supported)
- **Browser speechSynthesis** for “Listen” voice prompts

### Backend (API + Realtime)
- **Node.js** + **Express**
- **Socket.IO** for real-time chat
- **Prisma ORM** for database access
- **JWT authentication**
- **Helmet + CSP**, **rate limiting**, and **HPP protection**
- **Express-validator** for validation/sanitization

### Data & Integration Services
- **Airtel Money Uganda** payment initiation + webhook handling
- **Twilio** SMS + WhatsApp notifications + delivery receipts webhook
- **OpenAI** (optional) for text-to-speech audio generation for chat messages
- **Open‑Meteo** for climate risk alerts (weather-based)
- **Prometheus metrics** (prom-client)

### Blockchain (concept + implementation)
- Solidity contract exists under `blockchain/contracts/AgriMarketplace.sol`.
- Used for **auditability / non‑repudiation** concepts (recording tamper-evident proofs).
- The project supports simulation mode if no chain is configured.

## 4) High-level architecture (how components work together)

### Core modules
- **Frontend** (mobile UI): login/register, marketplace, orders, chat, profiles, dashboards.
- **Backend API**: auth, products, orders, payments, analytics, notifications, trust, climate, coop, traceability.
- **Database**: stores users/products/orders/transactions/ledger/messages/docs/notifications/logs.

### Clean separation (backend)
To avoid “mixed-up” code, the backend is structured as:
- `server/routes/*` → HTTP route wiring (thin)
- `server/controllers/*` → request-level orchestration
- `server/services/*` → business logic + integrations
- `server/db/prisma.js` → single Prisma client

This ensures maintainability and that features remain modular.

## 5) Core features (what the system can do)

### 5.1 User accounts and roles
Roles:
- **FARMER**
- **BUYER**
- **ADMIN**

Key security model:
- Newly created users (non-admin) are **unverified by default**.
- Admins can approve/verify users (approval workflow).
- Verified users can transact; unverified users are restricted for sensitive actions.

### 5.2 Marketplace (products)
- Farmers create product listings (price, quantity, unit, location).
- Product images upload (restricted to JPG/PNG/WEBP).
- Buyers can browse marketplace, filter/search products.
- Nearby product discovery based on location logic.

### 5.3 Orders
Order lifecycle:
- `PENDING` → `CONFIRMED` → `IN_TRANSIT` → `DELIVERED`
- Orders can be `CANCELLED` with rules applied.

Automation:
- Stock adjustments on cancel.
- Payment completion can trigger fulfillment steps (optional).

### 5.4 Payments (UGX Airtel Money + webhook automation)
Flow:
1) Buyer initiates payment for a confirmed order.
2) Airtel Money request is sent to buyer’s phone for approval.
3) Airtel webhook posts status updates back to the server.
4) On completed payments:
   - transaction is updated
   - notifications are sent
   - ledger entries are created (idempotent)
   - optional automation moves order to next stage

### 5.5 Ledger (double-entry + subledger)
Purpose: auditability and professional accounting structure.
- Base accounts: Airtel clearing, platform fees, farmer payables.
- Per-farmer **subledger** accounts.
- Idempotent posting for Airtel payments (no double posting).

### 5.6 Notifications (SMS + WhatsApp, no Firebase dependency)
Notifications supported:
- Payment updates
- Order updates
- Chat message notification (short message to avoid content leakage)

Delivery receipts:
- Twilio status callback updates message delivery statuses.

### 5.7 Real-time chat + voice accessibility
Chat provides:
- Real-time text messaging via Socket.IO
- Automatic **text-to-speech voice message** generation (receiver gets text + voice)
- Optional **voice input** via Web Speech API (mic button)

### 5.8 Security (priority design goal)
Implemented security controls:
- JWT auth + role-based access control
- Account verification guard (`requireVerified`)
- Stronger HTTP headers + CSP via Helmet
- Rate-limiting (global + tighter on login/register)
- HPP protection
- Mass-assignment prevention in updates
- Token invalidation on password change (`passwordChangedAt`)
- Audit log model for sensitive events

### 5.9 Trust Score (anti-middleman + user trust)
Trust score is an **explainable score** shown to users:
Signals:
- Verified status
- Account age
- Deliveries vs cancellations (buyer or farmer)
- Farmer rating average

The UI shows Trust badges on:
- Marketplace
- Buyer dashboard
- Product details

### 5.10 Proof of Delivery (PoD) — dispute reduction
PoD is a simple, effective mechanism:
- Farmer generates a **one-time delivery code** for an in-transit order.
- Buyer confirms delivery by entering the code.
- This reduces disputes and strengthens non-repudiation.
SMS fallback (rural):
- Buyer can confirm with an inbound SMS command (Twilio).

### 5.11 Traceability timeline (batch + events)
Public traceability (no PII):
- Product batches can be created by farmers.
- Events added: harvest, storage, transport, delivery, etc.
- Buyers can view trace timeline on product details.

### 5.12 Cooperatives (unique practical feature)
Farmers can create and join cooperatives:
- pool inventory
- bulk negotiation
- shared transport concept

UI: `/coops`

### 5.13 Climate risk alerts (decision support)
Weather alerts (Open‑Meteo) cached in DB:
- rain risk
- heat risk
- wind risk

Displayed on:
- Farmer dashboard
- Buyer dashboard

### 5.14 Demo Mode (panel-friendly)
To present smoothly even if external services are not fully configured, the admin dashboard includes a **Demo Mode toggle** that:
- shows a curated “demo quick actions” section
- provides example Trust Score + PoD code + SMS commands
- can attempt “live demo calls” to safe endpoints (`/health`, climate alerts)

This helps deliver a confident panel demonstration under time constraints.

## 6) Key API endpoints (high-level)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh` (optional)
- `POST /api/auth/logout` (optional)

### Users
- `GET /api/users/profile/:id`
- `PUT /api/users/profile`
- `PUT /api/users/change-password`
- Admin: `GET /api/users` (list)
- Admin: `PATCH /api/users/:id/verify`

### Marketplace / Products
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/nearby`
- Farmer: `POST /api/products`
- Farmer: `PUT /api/products/:id`
- Farmer: `DELETE /api/products/:id`
- Farmer: `POST /api/products/:id/images`
- Farmer: `GET /api/products/farmer/my-products`

### Orders
- Buyer: `POST /api/orders`
- Buyer/Farmer/Admin: `PATCH /api/orders/:id/status`
- `GET /api/orders/my-orders`
- Buyer: `POST /api/orders/:id/review`

### Payments (Airtel Uganda)
- Buyer: `POST /api/payments/initialize`
- Public provider callback: `POST /api/payments/airtel/webhook`
- Buyer/Farmer/Admin: `GET /api/payments/status/:orderId`

### Proof of Delivery
- `POST /api/delivery-proof/generate`
- `POST /api/delivery-proof/confirm`
- `GET /api/delivery-proof/:orderId`

### Trust score
- `GET /api/trust/:userId`

### Climate
- `GET /api/climate/alerts?location=...`

### Cooperatives
- `GET /api/coop`
- `GET /api/coop/mine`
- Farmer: `POST /api/coop`
- Farmer: `POST /api/coop/join`

### Traceability
- Public: `GET /api/trace/product/:productId`
- Farmer: `POST /api/trace/batch`
- Farmer: `POST /api/trace/event`

### Notifications (Twilio)
- `POST /api/notifications/twilio/status` (delivery receipts)
- `POST /api/notifications/twilio/inbound` (SMS commands)

## 7) Database design (Prisma models)

Main models include:
- **User**, **Product**, **Order**, **Transaction**
- **LedgerAccount**, **JournalEntry**, **JournalLine**
- **Message** (chat), **Document** (uploads), **NotificationLog**, **DeviceToken**
- **DeliveryProof** (PoD)
- **ProductBatch**, **TraceEvent** (traceability)
- **CooperativeGroup**, **CooperativeMember**
- **ClimateAlert**
- **AuditLog**, **RefreshToken**

This schema supports both core marketplace flows and unique features (PoD, trust, traceability, coops).

## 8) Configuration (what must be in ENV for the system to run)

> Never commit `.env` to GitHub. Commit `.env.example` templates only.

### Backend required (minimum)
- `DATABASE_URL` (MySQL connection string)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (e.g. `2h`)
- `PORT` (e.g. `3001`)
- `NODE_ENV` (`development` or `production`)

### Frontend required (minimum)
- `VITE_API_URL` (e.g. `http://localhost:3001/api`)

### Recommended for production
- `CORS_ORIGINS` (comma-separated allowed origins)

### Optional (feature-based)
Payments (Airtel UG):
- `AIRTEL_UG_CLIENT_ID`
- `AIRTEL_UG_CLIENT_SECRET`
- `AIRTEL_UG_BASE_URL`
- Webhook secret/config values as required by provider implementation

Notifications (Twilio):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`
- `PUBLIC_BASE_URL` (for webhook callback URLs)
- `TWILIO_VALIDATE_WEBHOOK=true` (recommended)

Voice (OpenAI TTS):
- `OPENAI_API_KEY`

Redis (optional):
- `REDIS_URL`

Admin MFA enforcement (optional):
- `ENFORCE_ADMIN_MFA=true`

## 9) How to run locally (demo setup)

1) Install:
```bash
npm install
```

2) Setup DB env:
- create `prisma/.env` from the example and set `DATABASE_URL`

3) Migrate and generate:
```bash
npx prisma migrate dev
npx prisma generate
```

4) Start backend:
```bash
npm run server
```

5) Start frontend:
```bash
npm run dev
```

6) Generate documentation screenshots (optional):
```bash
npm run docs:screenshots
```

## 10) Testing strategy (what to say & what to do)

### Quick confidence checks
- `npm run lint`
- `npm run build`

### API testing (panel-friendly)
Use Postman/Insomnia to demonstrate:
- register/login
- create product
- create order
- Airtel initiate payment (or simulate webhook)
- generate PoD and confirm delivery
- show trust score, climate alerts, traceability timeline

### Automated testing (recommended next)
- Backend: Vitest + Supertest (API tests)
- Frontend: Vitest + React Testing Library
- E2E: Playwright

## 11) Most common panel questions & how to defend

**Q: Why blockchain?**
- “I use it for auditability/non‑repudiation (tamper‑evident proofs), not for forcing crypto payments.”

**Q: How do you reduce middlemen/fraud?**
- “Verified accounts + explainable Trust Score + PoD + audit logs.”

**Q: How do you support rural farmers?**
- “Simple Mode UI, voice prompts, offline-first product creation, SMS fallback commands.”

**Q: How is payment secured?**
- “Webhook verification + idempotency + ledger posting + notifications.”

**Q: What about security?**
- “JWT auth + role checks + verified checks + rate limits + CSP/headers + input validation + audit logs.”

## 12) Limitations and future improvements
- Add stronger location/geocoding for Uganda districts (real coordinates).
- Add more robust fraud/risk scoring, device fingerprinting, anomaly alerts.
- Full refresh-token flow in frontend for seamless sessions.
- More climate/disease model integrations (FAO/WorldBank + local data sources).
- Formal test suite + E2E pipelines.

---

## Appendix A: Documentation screenshots
Generated documentation mock screenshots live in:
- `docs/screenshots/*.png`

They are auto-generated from:
- `docs/mockups/screens/*.html`
- `docs/mockups/base.css`

Generate with:
```bash
npm run docs:screenshots
```

