# AgriConnect (DAFIS) — Technical Reference & Architecture Documentation

AgriConnect is a mobile-first digital agricultural platform designed for Ugandan smallholder farmers, buyers, agro-dealers, and agricultural cooperatives. It integrates real-time communications, machine learning-based price forecasts, automated accounting ledger systems, decentralized smart contract audit trails, dynamic onboarding verification rules, and offline fallback solutions (USSD & SMS commands) to enable friction-free trading and credit access in low-connectivity regions.

---

## 1. System Architecture & Directory Structure

AgriConnect is architected around a layered, decoupled design patterns to ensure scalability, ease of auditing, and modularity.

```mermaid
graph TD
    Client[Mobile-First Client React / Capacitor] -->|HTTP / REST| API[Express API Server]
    Client -->|WebSockets| SocketServer[Socket.IO Gateway]
    
    API -->|Routing| Routes[server/routes/*]
    Routes -->|Validation & Auth| Middleware[server/middleware/*]
    Middleware -->|Orchestration| Controllers[server/controllers/*]
    Controllers -->|Business Logic| Services[server/services/*]
    
    Services -->|Data Access| Prisma[Prisma ORM]
    Prisma -->|Queries| DB[(MySQL Database)]
    
    Services -->|Airtel UG Sandbox| Payments[mobileMoneySimService]
    Services -->|Twilio Gateway| Notifications[smsWhatsappService]
    Services -->|Open-Meteo REST| Weather[climateService]
    Services -->|Ethereum RPC / Ganache| Blockchain[blockchainService]
    Services -->|TensorFlow.js / Local NN| AI[aiService]
    Services -->|Redis Cache / Queues| Redis[redisService]
```

### 1.1 Core Layers
*   **Routing Layer (`server/routes/`)**: Validates HTTP payloads using `express-validator`, extracts routing parameters, and verifies credentials through the authentication middleware before delegating execution to the controllers.
*   **Controller Layer (`server/controllers/`)**: Manages the request/response cycle. It acts as an orchestrator, invoking one or multiple domain-specific services to fulfill requests.
*   **Services Layer (`server/services/`)**: Implements business rules and handles third-party system integrations (such as payment processing, Twilio, Open-Meteo, blockchain anchoring, and TensorFlow model operations).
*   **Database Layer (`server/db/`)**: Exposes a single, shared Prisma client instance, enabling transaction management, connection pooling, and standard CRUD capabilities on top of a MySQL database.

### 1.2 Directory Layout
*   `/src`: Frontend React application.
    *   `/src/components`: Reusable visual elements (e.g., dynamic forms renderer, dashboard cards).
    *   `/src/pages`: Top-level application routes (e.g., Marketplace, Co-ops, Dashboards, Form Builder).
    *   `/src/services`: API client calls powered by Axios.
    *   `/src/utils`: Accessibility utilities (Speech Recognition and Text-to-Speech synthesis).
*   `/server`: Express Node.js application.
    *   `/server/routes`: Route declarations mapping URL endpoints to controllers.
    *   `/server/controllers`: Controller files handling req/res handling.
    *   `/server/services`: Modules executing business logic.
    *   `/server/middleware`: Request filters (Rate-limiting, JWT check, role auth, verification guard).
    *   `/server/db`: Prisma database connector.
*   `/prisma`: Database schema definitions and migration records.
*   `/blockchain`: Smart contracts, compiled build artifacts, and migration scripts.
*   `/docs`: System documentations, mockups, and auto-generated system screenshots.

---


---

## 3. Advanced AI & Machine Learning Services

The platform integrates data-driven models via [aiService.js](file:///c:/Users/SKY%20ELECTRONIC/Desktop/git_edits/AgrifocusedFinalYear/server/services/aiService.js) to automate advisory and pricing operations.

### 3.1 TensorFlow.js Crop Price Predictor
The system features a dynamic neural network model that predicts the optimal price per kilogram for crops in Uganda.
*   **Inputs**: The feature vector consists of:
    1.  `monthOfYear / 12`: Temporal cycle capture.
    2.  `organic ? 1 : 0`: Quality premium check.
    3.  `Math.min(quantity / 1000, 1)`: Quantity discount scale.
    4.  `encodeLocationToNumber(location)`: Fractional hash encoding representing regional markets.
*   **Model Architecture**: A TensorFlow sequential model consisting of:
    *   An input layer with 4 dimensions mapping to a dense layer with 8 units using Rectified Linear Unit (`ReLU`) activation functions.
    *   A dense output layer with a single unit outputting predicted price values in UGX.
*   **Training Loop**: Automatically retrained in the background every 6 hours using up to 5,000 historical data points from the `PriceHistory` table, using the Adam optimizer (learning rate: 0.05) and Mean Squared Error (`MSE`) loss calculations over 60 epochs.
*   **Weighted Blending Output**: To guarantee accuracy, the final output blends the neural network prediction with multiple data signals:
    $$\text{Final Price} = \frac{(W_1 \cdot \text{ML}) + (W_2 \cdot \text{HistoryAvg}) + (W_3 \cdot \text{ListingAvg}) + (W_4 \cdot \text{WebPrice}) + (W_5 \cdot \text{Heuristic})}{(W_1 + W_2 + W_3 + W_4 + W_5)}$$
    Where weights adjust dynamically based on signal availability. The system falls back to traditional heuristic rules if the database lacks historical price data points.

### 3.2 Crop Suitability Advisor
Generates crop recommendations for farmers based on farm parameters:
*   Evaluates crops (e.g., tomatoes, rice, wheat, potatoes, onions, sugarcane) against farmer soil profiles (loamy, sandy-loam, clay, etc.) and regional climates (tropical, temperate, subtropical).
*   Calculates expected yields based on farm sizes and forecasts profitability by analyzing historical market prices against baseline production costs.

### 3.3 Demand Forecasting
Applies seasonal factors and historical order rates over 7, 14, and 30-day windows to classify crop demand levels (`High`, `Medium`, `Low`) and estimate transaction volumes.

### 3.4 Proactive Matchmaking
Automatically scans buyers and farmers:
*   For farmers, it surfaces the top 5 buyers who have recently purchased crops in matching categories.
*   For buyers, it queries active, verified listings in nearby subcounties using geo-coordinates.

### 3.5 AI-Enriched Guidance
Computes rule-based steps (e.g., completing verification, listing crop varieties, applying for export permits) and, if an `OPENAI_API_KEY` is provided, sends details to `gpt-4o-mini` to return tailored agribusiness advice.

---

## 4. Key Core Integrations

AgriConnect integrates with external network protocols to support local telecom services and security layers.

### 4.1 Airtel Money Uganda Gateway
The payment service handles automated collections and financial reconciliations.
*   **Collection Flow**: When a buyer initiates payment, the API makes a collection request to Airtel’s mobile money gateway.
*   **Webhook Verification & Idempotency**: Airtel callbacks post completion statuses to `/api/payments/airtel/webhook`. The endpoint:
    *   Validates cryptographic headers to confirm authenticity.
    *   Enforces transaction idempotency. If a transaction has already been processed, it immediately returns `200 OK` to prevent duplicate processing.
*   **Split Debt Auto-Deductions**: Upon payment confirmation, the system checks the `InputCredit` table for active farmer debts. If found:
    *   It deducts up to 50% of the crop payout to settle the input credit.
    *   The remaining amount is credited to the farmer's account.
*   **Auto-Fulfillment**: If configured globally or enabled by the farmer, completed payments automatically transition the order status to `IN_TRANSIT`.

### 4.2 Notification Gateway (Nodemailer + SendGrid Email)
Enables notification routing and authentication delivery.
*   **Strict Email-Only Notifications**: All user notifications (including order/payment updates and MFA login/setup OTP codes) are sent strictly to their registered email addresses. The system uses **Nodemailer** configured with a **SendGrid** SMTP relay (host `smtp.sendgrid.net`, port `587`) using SendGrid API keys for secure delivery. Message logs and delivery statuses are recorded in `NotificationLog` with the provider marked as `"sendgrid"`. External Twilio SMS/WhatsApp gateways are completely deactivated.
*   **Inbound Command Router**: Listens for incoming SMS text commands at `/api/notifications/twilio/inbound`. It processes commands using SMS command matching rules:
    *   `HELP`: Returns a quick syntax reference card.
    *   `STATUS <order_last8>`: Queries order status.
    *   `DELIVER <order_last8> <code>`: Confirms order delivery using the farmer’s generated Proof of Delivery (PoD) passcode.



### 4.4 Dynamic Form Builder
Allows administrators to define crop-specific input fields.
*   **JSON Field Configurations**: Custom form designs are stored as structured JSON schema templates.
*   **Render Mapping**: The client reads the schema and renders form controls dynamically (validation ranges, select options, checkboxes).
*   **Storage**: Captured fields are saved as structured JSON in the product's `customFields` column.

### 4.5 Credit Scoring Engine
Computes credit ratings (on a 300 to 850 scale) using:
*   **Income (35%)**: +10 points for every UGX 100,000 in completed sales (up to 200 points).
*   **Investment (20%)**: +20 points for every UGX 50,000 spent on inputs (up to 100 points).
*   **Repayment History (30%)**: +30 points per repaid credit (up to 150 points), minus 100 points for defaults.
*   **Identity (15%)**: +50 points for completed verification.
*   *Credit Rating Categories*: **Excellent** ($\ge 700$), **Good** ($600 \text{ to } 699$), **Fair** ($< 600$).

### 4.6 Registration Rules Engine
Evaluates new user signups against active database rules:
*   **Rule Evaluators**: Processes rules (missing profile fields, phone validation patterns, allowed/blocked email domains, role auto-approvals).
*   **Action Precedence**: Enforces strict action rules: `REJECT` $\gt$ `REVIEW` $\gt$ `APPROVE`. A reject rule immediately halts evaluation, while review rules override approval rules.

### 4.7 Document OCR Parser
Processes document verification:
*   Receives file uploads via Multer.
*   Parses text content from PDF and DOCX files.
*   Stores extracted text for administrator search and review.

---

## 5. Security & Hardening Model

AgriConnect implements multiple security controls to safeguard financial and user data.

```
[Incoming Request]
       |
  [Helmet CSP] (HTTP Header Protections)
       |
  [Rate Limiting] (IP-based Request Caps)
       |
  [HPP Middleware] (Query Parameter Pollution Prevention)
       |
  [JWT Auth & MFA] (Identity Verification)
       |
  [requireVerified] (Verified Role Access Safeguard)
       |
[Route Controller] (Resource Access Grant)
```

*   **HTTP Protections**: Uses `helmet` to configure secure Content Security Policy (CSP) headers, prevent MIME-sniffing, and disable cross-site scripting vulnerabilities.
*   **Rate Limiting**: Enforces request rate limits globally (100 requests per 15 minutes) and stricter limits on authentication endpoints (5 requests per 15 minutes).
*   **Authentication & MFA**: Implements JWT-based sessions. Supports Multi-Factor Authentication via TOTP. Updates the `passwordChangedAt` timestamp upon password changes, instantly revoking all active JWT sessions.
*   **Access Control**: Restricts sensitive actions (listing products, payment initiation, cooperative management) to verified accounts.
*   **Sanitization**: Validates and sanitizes incoming request payloads using `express-validator` to prevent SQL injection and mass-assignment vulnerabilities.

---

## 6. System Core API Endpoints

### 6.1 Authentication & User Management
*   `POST /api/auth/register`: Create user account. Triggers the onboarding rules engine.
*   `POST /api/auth/login`: Log in to user account. Enforces rate limits and checks MFA.
*   `POST /api/auth/mfa/setup`: Generates TOTP registration details and QR codes.
*   `POST /api/auth/mfa/verify`: Validates TOTP setup codes and activates MFA.
*   `PATCH /api/users/:id/verify`: (Admin) Manual verification approval/rejection.

### 6.2 Product Marketplace
*   `GET /api/products`: Queries active listings with location, category, and organic filters.
*   `GET /api/products/nearby`: Location-based discovery using coordinates.
*   `POST /api/products`: Create a new crop listing. Renders schemas based on custom field templates.
*   `POST /api/products/:id/images`: Upload product media. Restricted to JPG, PNG, and WEBP formats.

### 6.3 Order Lifecycle
*   `POST /api/orders`: Initiate purchase requests. Automatically reserves inventory.
*   `PATCH /api/orders/:id/status`: Transition order states. Validates role permissions and status sequences.
*   `POST /api/orders/:id/review`: Submit product feedback.

### 6.4 Payments & Ledger
*   `POST /api/payments/initialize`: Request payment collection via Mobile Money.
*   `POST /api/payments/airtel/webhook`: Callback endpoint for Airtel UG payment status updates.
*   `GET /api/payments/status/:orderId`: Fetch the payment status of an order.
*   `GET /api/ledger/accounts`: (Admin) List general ledger accounts.

### 6.5 Proof of Delivery & Fallbacks
*   `POST /api/delivery-proof/generate`: Farmer request to generate a delivery verification code.
*   `POST /api/delivery-proof/confirm`: Buyer submission to verify delivery.
*   `POST /api/notifications/twilio/inbound`: Listen for inbound SMS commands.
*   `POST /api/ussd`: Simulates USSD callbacks.

---

## 7. Setup & Run Guide

### 7.1 Environment Variables Setup
Create a `.env` configuration file in the project root:

```env
# Database & Web Server
DATABASE_URL="mysql://username:password@localhost:3306/agriconnect"
PORT=3001
NODE_ENV=development
JWT_SECRET="your-jwt-secret-string"
JWT_EXPIRES_IN=2h

# Payment Gateway Configuration
PLATFORM_FEE_RATE=0.02
AUTO_FULFILL_ON_PAYMENT=true

# Twilio Gateway Configuration
TWILIO_ACCOUNT_SID="ACxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxx"
TWILIO_SMS_FROM="+1234567890"
TWILIO_WHATSAPP_FROM="whatsapp:+1234567890"

# SendGrid Email Configurations
SENDGRID_API_KEY="SG.your-sendgrid-api-key"
SENDGRID_FROM="noreply@dafis.ug"

# External Integrations
OPENAI_API_KEY="sk-proj-xxxxxxxx"
BLOCKCHAIN_RPC_URL="http://localhost:7545"
CONTRACT_ADDRESS="0xContractAddress"
```

### 7.2 Database Setup & Running
Install project dependencies and apply database migrations:

```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npx prisma migrate dev

# 3. Seed market price databases
npm run db:seed:prices

# 4. Launch development API server
npm run server
```

In a separate terminal, launch the frontend application:
```bash
npm run dev
```
