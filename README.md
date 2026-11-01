# FoodHub — Online Food Ordering & Delivery Platform with Yantra Ticketing Integration

FoodHub is a complete, production-ready, end-to-end Food Ordering and Delivery Web Application supporting four user roles (**Customer**, **Restaurant Owner**, **Delivery Partner**, and **Administrator**), payment-free order confirmation, real-time 8-stage order tracking, and full **Yantra Ticketing Agent** integration (**Support Widget**, **Ticketing REST APIs**, and **HMAC-SHA256 Verified Webhooks**).

---

## 1. Supported User Roles & Demo Credentials

You can switch between all 4 roles using the **Workspace Role Switcher** bar at the top of the interface or sign in via JWT authentication (`Password123!` for all demo accounts):

| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@foodhub.com` | `Password123!` | Search dishes/restaurants, filter by diet/rating/time, customize items, apply coupons (`WELCOME50`, `FREEDEL`, `FEAST10`), place payment-free orders, track live 8-stage progress, reorder, and raise/reply to Yantra support tickets. |
| **Restaurant Owner** | `owner@foodhub.com` | `Password123!` | Manage restaurant profile & operating hours, toggle kitchen availability, add/edit/delete menu items, accept/reject incoming orders, and advance kitchen status (`accepted` → `preparing` → `ready_for_pickup`). |
| **Delivery Partner** | `rider@foodhub.com` | `Password123!` | Toggle online/offline rider status, view pickup & customer dropoff instructions, and advance delivery stages (`picked_up` → `out_for_delivery` → `delivered`). |
| **Administrator** | `admin@foodhub.com` | `Password123!` | View platform KPIs & GMV, approve/suspend restaurants & users, manage food categories & coupons, inspect security audit logs, and test Yantra webhooks in the **Webhook Verification Lab**. |

---

## 2. Yantra Ticketing Agent Integration Reference

### 2.1 Support Widget Endpoints
- **Widget Configuration**: `GET /api/external/ticketing/widget-config`
- **Embeddable Widget Script**: `GET /api/external/ticketing/widget.js`

### 2.2 Ticketing REST APIs
- **Create Ticket**: `POST /api/external/ticketing/tickets` (Protected by `x-api-key`)
- **Retrieve Ticket**: `GET /api/external/ticketing/tickets/:ticketNumber` (Protected by `x-ticket-token` or `x-api-key`)
- **Retrieve Messages (with Incremental Polling)**: `GET /api/external/ticketing/tickets/:ticketNumber/messages?since=<ISO_TIMESTAMP>` (Protected by `x-ticket-token`)
- **Send Customer Reply / Reopen Ticket**: `POST /api/external/ticketing/tickets/:ticketNumber/messages` (Validates `accessToken` in the JSON body; automatically reopens resolved tickets when a customer replies)
- **Legacy Ticket Submission**: `POST /api/tickets/submit`

### 2.3 Dedicated HTTPS Webhook Receiver
- **Endpoint**: `POST /api/webhooks/yantra`
- **Headers**:
  - `X-Yantra-Signature: t=<timestamp>,v1=<hmac_sha256_signature>`
  - `X-Yantra-Event`: `ticket.created` | `ticket.message` | `ticket.status_changed` | `ticket.resolved`
  - `X-Yantra-Delivery`: Unique delivery identifier for idempotent deduplication
- **Security Guarantees**:
  - Raw request body HMAC-SHA256 verification using `crypto.timingSafeEqual`
  - Replay timestamp window validation (`±300s`)
  - Duplicate event detection via `X-Yantra-Delivery`
  - Out-of-order event protection using monotonic `lastEventTimestamp` comparison

---

## 3. Local Installation & Execution

```bash
npm install
cp .env.example .env
npm run dev
```

For production build and verification:
```bash
npm run build
npm start
```
