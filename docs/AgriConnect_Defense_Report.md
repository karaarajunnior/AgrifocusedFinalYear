# AgriConnect — Project Defense Report (Final Year)

## 1) Project overview (what I built)

**AgriConnect** is a **mobile-first agricultural marketplace** that connects **verified farmers** and **buyers**, supports **UGX Airtel Money** payments, and adds practical, real-world features for rural adoption:
- **Trust Score** (anti‑middleman / credibility signals)
- **Proof of Delivery (PoD)** using a one-time code (reduces disputes)
- **Offline-first UX** + **SMS fallback commands**
- **Traceability timeline** (batches/events) for food safety/export readiness
- **Cooperative groups** for pooled inventory and better negotiation
- **Climate risk alerts** (weather-based)
- **Real-time chat** with **text-to-voice** support and voice input
- **Double-entry ledger/sub-ledger** for financial auditability
- Security hardening (headers/CSP, rate limits, validation, audit logs, token revocation on password change)

The system is designed to be **usable by local farmers** (Simple Mode UI, big buttons, voice prompts) while being **credible to professionals** (security, auditability, modular architecture).

---

## 2) Technology stack (frontend + backend)

### Frontend (Vite + React)
- **React + TypeScript**
- **Tailwind CSS** for modern mobile UI
- **Axios** for API calls (`src/services/api.ts`)
- **Socket.IO client** for real-time chat (`src/pages/ChatPage.tsx`)
- **Web Speech API** for voice input (mic button in chat)
- **Speech Synthesis** for “Listen” prompts (`src/utils/speech.ts`, `src/components/SpeakButton.tsx`)

### Backend (Node.js + Express)
- **Express** REST API (`server/index.js`)
- **Socket.IO** server for chat + notifications (`server/socket.js`)
- **Prisma ORM** + **MySQL** database (`prisma/schema.prisma`, `server/db/prisma.js`)
- **JWT authentication** + role-based authorization (`server/middleware/auth.js`)

### Integrations / Services
- **Airtel Money Uganda** payment initiation + webhook updates (`server/services/payments/airtelUgService.js`, `server/routes/payments.js`)
- **Twilio** SMS/WhatsApp notifications + delivery receipts (`server/services/smsWhatsappService.js`, `server/routes/notifications.js`)
- **Open‑Meteo** weather forecast for climate alerts (`server/services/climateService.js`)
- **OpenAI** (optional) for chat text-to-speech voice messages (`server/services/ttsService.js`)
- **Prometheus metrics** (performance/monitoring) (`server/metrics.js`)

### Blockchain (concept + implementation)
- Solidity contract (`blockchain/contracts/AgriMarketplace.sol`)
- Backend blockchain service supports real chain or simulation (`server/services/blockchainService.js`)
- Used to support **auditability/non‑repudiation** concepts (tamper‑evident proofs).

---

## 3) System architecture (how everything fits together)

### Backend layering (clean separation)
To prevent “mixed up” code and keep the system maintainable:
- `server/routes/*`: HTTP route wiring (thin)
- `server/controllers/*`: request-level orchestration
- `server/services/*`: business logic + integrations (payments, notifications, trust score, PoD, climate)
- `server/db/prisma.js`: single shared Prisma client

### Frontend architecture
- Pages in `src/pages/*`
- Reusable components in `src/components/*`
- Hooks in `src/hooks/*`
- Shared utilities in `src/utils/*`

---

## 4) User roles and security model

### Roles
- **ADMIN**: approvals, monitoring, demo mode, audit view
- **FARMER**: product listing, fulfill orders, generate PoD code, co-ops
- **BUYER**: order, pay with Airtel Money, confirm delivery, review

### Approval workflow (prevents fake users)
- New users (non-admin) are **unverified by default**
- Admin approves users (buyers/farmers) before full platform access
- Middleware `requireVerified` enforces this across sensitive endpoints

### Authentication
- JWT tokens (Authorization header)
- MFA support (TOTP) for added security
- Token invalidation after password change using `passwordChangedAt`

---

## 5) Full feature list (frontend + backend)

### 5.1 Marketplace & product management
**Frontend**
- `src/pages/MarketplacePage.tsx`: browse/filter products, show farmer Trust badge
- `src/pages/ProductDetails.tsx`: full product view + Trust badge + traceability timeline

**Backend**
- `GET /api/products` list with filtering
- `GET /api/products/:id` full detail (farmer, reviews, price history, custom fields)
- `GET /api/products/nearby` location-based discovery
- `POST /api/products` farmer create
- `PUT /api/products/:id` farmer update (whitelisted fields)
- `DELETE /api/products/:id` farmer delete
- `POST /api/products/:id/images` upload images (type/size restricted)

**Security**
- Input validation (`express-validator`)
- Field whitelisting prevents mass assignment
- Upload restrictions: only JPG/PNG/WEBP allowed

### 5.2 Orders lifecycle management
**Frontend**
- `src/pages/OrdersPage.tsx`: buyers and farmers manage statuses, payments, PoD

**Backend**
- `POST /api/orders` buyer creates order
- `PATCH /api/orders/:id/status` role-based transitions
- `GET /api/orders/my-orders` shows buyer/farmer orders
- Reviews: `POST /api/orders/:id/review`

### 5.3 Payments (UGX Airtel Money) + automation
**Frontend**
- “Pay with Airtel Money” button in Orders page

**Backend**
- `POST /api/payments/initialize`: initiates Airtel collection
- `POST /api/payments/airtel/webhook`: provider callback updates transaction status
- webhook is made **idempotent** (prevents duplicate side effects)

**Accounting**
- On completed payment, ledger posting creates double-entry journal entries (idempotent)

### 5.4 Ledger and sub-ledger (auditability)
**Backend**
- Models: `LedgerAccount`, `JournalEntry`, `JournalLine`
- Service: `server/services/ledgerService.js`
- Admin endpoints: `server/routes/ledger.js`

Purpose:
- professional audit trail (cash clearing, platform fees, farmer payables)
- farmer sub-ledgers for transparency

### 5.5 Notifications: SMS + WhatsApp
**Backend**
- Twilio-based SMS/WhatsApp service (no Firebase required)
- User preferences: enable/disable chat/payment/order notifications
- Delivery receipts webhook updates logs

### 5.6 SMS fallback commands (rural support)
**Backend**
- `POST /api/notifications/twilio/inbound`
- Commands:
  - `HELP`
  - `STATUS <order_last8>`
  - `DELIVER <order_last8> <code>`

Benefit:
- farmers/buyers can complete critical actions even without the app UI.

### 5.7 Proof of Delivery (PoD)
**Frontend**
- Farmer generates code for `IN_TRANSIT` orders
- Buyer confirms delivery with the code (modal)

**Backend**
- `POST /api/delivery-proof/generate`
- `POST /api/delivery-proof/confirm`
- `GET /api/delivery-proof/:orderId`

Impact:
- reduces disputes and strengthens non‑repudiation.

### 5.8 Trust Score (anti-middleman)
**Frontend**
- Trust badges shown on marketplace, buyer dashboard, product details

**Backend**
- `GET /api/trust/:userId`
- Score is explainable: verified status, account age, deliveries/cancellations, ratings.

### 5.9 Traceability timeline (batches/events)
**Frontend**
- Product details shows batch timeline (harvest/storage/transport events)

**Backend**
- Public: `GET /api/trace/product/:productId`
- Farmer: `POST /api/trace/batch`
- Farmer: `POST /api/trace/event`

### 5.10 Cooperative groups
**Frontend**
- `src/pages/CoopPage.tsx` (create/join/list)

**Backend**
- `GET /api/coop`
- `GET /api/coop/mine`
- `POST /api/coop` (farmer create)
- `POST /api/coop/join` (farmer join)

### 5.11 Climate risk alerts
**Frontend**
- `ClimateAlertsCard` on farmer and buyer dashboards

**Backend**
- `GET /api/climate/alerts?location=...`
- Uses Open‑Meteo forecasts and caches results in DB.

### 5.12 Real-time chat + voice
**Frontend**
- `src/pages/ChatPage.tsx`: conversations, messages, mic input

**Backend**
- Socket.IO stores messages in DB and optionally generates TTS audio
- SMS/WhatsApp notifications send “open the app” style alerts (privacy-friendly)

### 5.13 Admin dashboard + Demo Mode
**Frontend**
- Admin dashboard shows monitoring, approvals, notification stats
- **Demo Mode** toggle provides panel-ready quick actions and demo output

**Backend**
- Analytics endpoints for dashboard
- Audit log endpoint: `/api/audit` (admin-only)

### 5.14 Dynamic Form Builder (custom fieldsets + fields) — REQUIRED by project uniqueness

This feature makes the system **flexible** for different crops/markets without changing code each time.

**Frontend (Admin)**
- Page: `/form-builder`
- Admin can define:
  - multiple **fieldsets** (e.g., “Quality”, “Logistics”)
  - each with custom **fields** (text/number/select/checkbox/date)
- Stored as a **form definition JSON** in browser storage (`PRODUCT_FORM_KEY`)

Files:
- `src/pages/FormBuilderPage.tsx`
- `src/utils/formDefinitions.ts`

**Frontend (Farmer)**
- Farmer “Add product” wizard includes a final step:
  - renders dynamic fieldsets using a generic renderer component
  - captures custom values into `customFields`

Files:
- `src/pages/FarmerDashboard.tsx`
- `src/components/DynamicFieldsetForm.tsx`

**Backend + DB**
- Prisma: `Product.customFields` (JSON stored as text)
- Product creation/update accepts `customFields` object and stores it.
- Product details returns parsed `customFields` for display.

Files:
- `prisma/schema.prisma` (`Product.customFields`)
- `server/controllers/productsController.js`
- `server/routes/products.js`

Impact:
- This makes your system *more unique than typical agri marketplaces* because it becomes configurable like a platform.

### 5.15 Documents upload/download (paperwork automation base)
**Backend**
- Upload PDF/DOCX/TXT, extract text, store for AI summarization later
- Download original file endpoint

### 5.16 Performance monitoring / metrics
**Backend**
- Prometheus metrics endpoint and request-duration metrics
- Health endpoint for uptime/latency display

---

## 6) Environment configuration (what must be set to run)

### Minimum backend env
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `NODE_ENV`

### Frontend env
- `VITE_API_URL`
- Optional: `VITE_SUPPORT_PHONE`, `VITE_SUPPORT_WHATSAPP`

### Feature-specific env (only if you demo those)
Twilio:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`
- `PUBLIC_BASE_URL`

Airtel UG:
- Airtel client credentials + base URL (as per implementation)

OpenAI TTS:
- `OPENAI_API_KEY`

Blockchain:
- `BLOCKCHAIN_RPC_URL`, `CONTRACT_ADDRESS` (optional; simulation works without)

---

## 7) How I would demo to the panel (recommended script)

1) **Admin Dashboard (Demo Mode ON)**:
   - show unique features at a glance
   - show approvals and notification stats

2) **Marketplace**:
   - show Trust badges and verified farmers

3) **Product Details**:
   - show traceability timeline + trust

4) **Order flow**:
   - buyer places order → farmer confirms → buyer pays Airtel → farmer marks in transit

5) **Proof of Delivery**:
   - farmer generates PoD code → buyer confirms delivery

6) **Chat**:
   - show text + audio/voice, mic input

7) **Dynamic Forms**:
   - admin adds a new custom fieldset (e.g. “Export certification”)
   - farmer immediately sees it when adding a product (no code changes)

8) **Co-ops + Climate alerts**:
   - show farmer climate card + co-op page

---

## 8) Professional Q&A defense (short answers)

**Q: What makes your project unique?**
- “Trust score + PoD + dynamic form builder + offline/SMS fallback + traceability + cooperative mode.”

**Q: How do you handle low literacy/low connectivity?**
- “Simple Mode, voice prompts, offline queues, SMS commands.”

**Q: How do you prevent fraud/middlemen?**
- “Verification workflow + explainable trust score + audit logs + PoD.”

**Q: Why ledger?**
- “Financial auditability and correctness; supports farmer payables and platform fee accounting.”

**Q: Why blockchain?**
- “Auditability/non‑repudiation: tamper-evident proofs; not forcing crypto payments.”

---

## 9) Conclusion

AgriConnect is designed to be **usable in Uganda**, **credible to professionals**, and **unique** among typical agri marketplaces due to **dynamic configurability** (form builder), **trust mechanisms**, and **rural-first design**.

