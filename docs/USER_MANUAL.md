# AgriConnect (DAFIS) — Comprehensive User Manual

Welcome to **AgriConnect** (Digital Agricultural Marketplace & Financial Inclusion System - DAFIS). This platform is designed to connect verified farmers, buyers, agro-dealers, and cooperatives, providing digital trading, payment tracking, credit scoring, and accessibility fallback tools.

---

## 1. Platform Roles & Authorization Matrix

The platform supports five specialized roles:

| Feature / Capability | Farmer | Buyer | Agro-Shop | Supermarket | Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Marketplace** | Yes | Yes | Yes | Yes | Yes |
| **List Agricultural Crops** | Yes | No | No | No | No |
| **Purchase Crops (Airtel UG)** | No | Yes | No | Yes | No |
| **Manage Cooperative Groups** | Yes | No | No | No | No |
| **List Agro-Inputs (Seeds/Fertilizer)** | No | No | Yes | No | No |
| **Apply for Input Credit** | Yes | No | No | No | No |
| **Approve / Grant Input Credit** | No | No | Yes | No | No |
| **Define Crop Form Templates** | No | No | No | No | Yes |
| **Configure Onboarding Rules** | No | No | No | No | Yes |
| **Approve User Account Verification** | No | No | No | No | Yes |
| **Audit Ledger & Logs** | No | No | No | No | Yes |

---

## 2. Administrator Guide

As an administrator, you manage system governance, onboarding verification, dynamic templates, audit compliance, and demo modes.

### 2.1 Managing User Verifications
To prevent fraudulent agents or unauthorized middlemen:
1. Log in to the **Admin Dashboard**.
2. Navigate to the **User Approvals** tab. You will see a list of accounts flagged as `Awaiting Review`.
3. Click **Review Documents** to inspect extracted OCR text from submitted IDs or registration certificates.
4. Select **Approve Verification** (account is marked as verified, unlocking trade capabilities) or **Reject Verification** (account is deactivated with a specified reason).

### 2.2 Onboarding Rules Configurations
Administrators can customize the signup verification rules:
*   Navigate to **System Configurations** $\rightarrow$ **Registration Rules**.
*   You can set priorities, actions (`REJECT`, `REVIEW`, `APPROVE`), and validation criteria for rule types:
    *   *Required Fields*: Enforce profile requirements.
    *   *Disposable Email Blocks*: Ban fake email providers.
    *   *Phone Format Check*: Enforce valid phone structures.
    *   *Role Approvals*: Automate validation for specific user roles.

### 2.3 Product Crop Form Templates (Form Builder)
Allows customizing forms for different crop categories without making database changes:
1. Navigate to the `/form-builder` route.
2. Select a crop category (e.g., *Coffee*, *Vegetables*, *Organic*).
3. Create custom fields by specifying data types (e.g., text, number, select dropdown, checkbox, date).
4. Save the configuration. Farmers will instantly see these fields when listing items in that category.

### 2.4 Audit Logs & Financial Ledger Analytics
To review system activity and ensure transaction compliance:
*   **Audit Trail Logs**: Access the **Audit Logs** view to inspect user sessions, API events, IP addresses, and database changes.
*   **Ledger Reports**: Check the **General Ledger** dashboard to view double-entry balances (clearing cash flows, collected platform fees, and farmer payable liabilities).

### 2.5 Presentation Demo Mode Controls
For system presentations:
1. Locate the **Demo Mode** toggle on the header of the Admin Dashboard.
2. Turning Demo Mode **ON** will:
    *   Expose a demo quick actions panel.
    *   Bypass payment gateways to simulate instant Airtel Money Uganda webhook completions.
    *   Expose simulated USSD command builders and audit-trail indicators.

---

## 3. Farmer Operations Manual

AgriConnect helps farmers list harvests, join cooperatives, track supply chain histories, and access credit schemes.

### 3.1 Registration & Verification Setup
1. Open the signup page and select the **Farmer** role.
2. Enter your name, email, phone number, and location.
3. Upload verification documents (e.g., national ID, land registration, cooperative certificates).
4. Wait for the dynamic rules engine or an admin to review and verify your account.

### 3.2 Listing a Harvest (Crops)
1. Navigate to the **Farmer Dashboard** and click **Add Product**.
2. Select the crop category and enter standard details (name, quantity, price, harvest date, coordinates).
3. Complete any dynamic fields rendered based on the admin's template.
4. If blockchain integration is configured, toggle **Record on Ledger** to register a permanent proof of your listing.

### 3.3 Product Batches & Traceability Events
To build trust with international exporters and premium buyers:
1. Navigate to **Traceability Log** under your product details.
2. Click **Create New Batch** to generate a unique batch code.
3. Post chronological timeline events (e.g., *Harvested on 2026-06-19*, *Stored at 15°C*, *Dispatched to Jinja*).
4. Buyers will see this verified timeline directly on your product listings.

### 3.4 Joining Cooperatives
To coordinate bulk shipments and pool inventories:
1. Navigate to `/coops` or select **Cooperatives** in the menu.
2. Browse active groups in your district or click **Create Co-op Group** to start a new one.
3. Group members can pool crop listings to fulfill large buyer orders.

### 3.5 Managing Orders & Proof of Delivery (PoD)
When a buyer places an order:
1. You will receive an email alert. Review order details on your dashboard and click **Confirm Order**.
2. Once the buyer completes the Airtel payment, the order moves to **In Transit** (or you can manually dispatch it).
3. Click **Generate Delivery Code** to create a one-time code.
4. Provide this code to the buyer upon physical handover of the crops. The buyer enters this code to complete the order.

### 3.6 Checking Credit Limits & Agro-input Credits
Farmers can purchase inputs (seeds, fertilizer) on credit:
1. Check your credit status in **My Credit Profile**. Your credit limit updates based on completed sales.
2. Browse the **Agro-Inputs Store** and select products.
3. Click **Request Credit**. Choose a repayment model (e.g., automatic deductions of up to 50% from future crop sales).
4. Once approved by the agro-dealer, pick up the inputs. Repayment deductions will apply automatically to subsequent sales.

---

## 4. Buyer Operations Manual

Connect with local farmers, initiate secure payments, and verify deliveries.

### 4.1 Browsing & Localized Filtering
1. Open the **Marketplace**.
2. Use filters to search by crop category, price range, and organic certification.
3. Enable **Nearby Discovery** to find crop listings sorted by proximity to your current location.

### 4.2 Placing Orders & Airtel Money UG Payments
1. Select a crop listing and click **Order Now**.
2. Enter the quantity and delivery notes, then click **Place Order**.
3. Once the farmer confirms the order, navigate to **My Orders** and click **Pay with Airtel Money**.
4. Enter your mobile money phone number.
5. You will receive a secure Airtel Money prompt (USSD Push) on your phone. Enter your PIN to approve the transaction.
6. The transaction status will update on the platform once payment is confirmed.

### 4.3 Confirming Deliveries using PoD Codes
1. Inspect the crops upon physical delivery.
2. Request the one-time delivery code from the farmer.
3. Click **Confirm Delivery** on the order detail page and enter the code.
4. Confirming delivery releases funds to the farmer and updates the audit trail.
5. Submit a rating and review for the farmer.

---

## 5. Agro-Shop Operations Manual

List inputs and manage credit arrangements for farmers.

### 5.1 Listing Inputs
1. Select the **Agro-Shop** role on registration.
2. Navigate to **Manage Inputs Catalog** and list products (e.g., fertilizer, hybrid maize seeds, tools).
3. Set descriptions, pricing, and stock levels.

### 5.2 Approving Credits & Customizing Deductions
1. Navigate to **Credit Management** to view pending credit requests from farmers.
2. Review the farmer's computed **DAFIS Credit Score** and historical repayment logs.
3. Set a dynamic deduction percentage (e.g., 20% or 30% applied to subsequent sales) and approve the application.

---

## 6. Offline USSD & SMS Command Manual

AgriConnect supports feature phone operations in low-connectivity areas.

### 6.1 USSD Menu Flow (*284#)
Dial `*284#` on your mobile phone to access the DAFIS menu:

```
[Dial *284#]
     |
     +-- 1. List Harvest -----> [Select Crop: 1. Coffee, 2. Maize, 3. Beans] 
     |                               |
     |                               +--> [Enter Quantity in Kg]
     |                                         |
     |                                         +--> [Enter Price per Kg]
     |                                                   |
     |                                                   +--> [Confirm Listing]
     |
     +-- 2. Check Market Prices --> [Queries latest regional averages]
     |
     +-- 3. My Credit Score -------> [Displays rating and credit limit in UGX]
     |
     +-- 4. Help ------------------> [Displays customer support options]
```

### 6.2 SMS Command Gateways
Send text commands to the platform gateway number:

*   **`HELP`**: Get the command reference guide.
*   **`STATUS <order_last_8_characters>`**: Query order and payment details.
    *   *Example SMS*: `STATUS d3f82c4a`
    *   *Response*: `DAFIS: Order d3f82c4a is CONFIRMED. Payment: PENDING.`
*   **`DELIVER <order_last_8_characters> <pod_code>`**: Confirm order delivery.
    *   *Example SMS*: `DELIVER d3f82c4a 872910`
    *   *Response*: `DAFIS: Order d3f82c4a marked as DELIVERED. Thank you.`

---

## 7. Accessibility Features Guide

AgriConnect includes tools to support diverse accessibility needs:

*   **Simple UI Mode**: Toggle the **Simple Mode** option in the application settings. This displays a simplified interface with high-contrast text, larger buttons, and streamlined flows.
*   **Text-to-Speech (TTS) voice playback**: Click the speaker icon ("Listen") on chat screens or crop descriptions. The system will read the text details aloud.
*   **Voice Input Assistance**: Click the microphone icon on chat windows to dictate messages. The system uses speech recognition to convert voice inputs to text.
