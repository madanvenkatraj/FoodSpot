# FoodHub — Yantra Ticketing Agent End-to-End Integration Plan

## 1. Product & Architectural Overview

FoodHub will integrate the **Yantra Ticketing Agent** (`https://www.yantraaicofounder.com`, key `ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E`) across its two-workspace architecture (**Customer App** and **Admin Console**) using all three authoritative integration mechanisms simultaneously:

1. **Embeddable Support Widget**
   - Root layout script snippet (`<!-- yantra-support-widget:start --> <script src="https://www.yantraaicofounder.com/api/external/ticketing/widget.js" data-api-key="ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E" defer></script> <!-- yantra-support-widget:end -->`) plus local `/api/external/ticketing/widget.js` and `/api/external/ticketing/widget-config` endpoints.
   - Floating support launcher and interactive drawer in the Customer App that persists each ticket's `accessToken` in both browser storage and the authenticated customer's profile.
2. **Ticketing REST APIs (Hybrid Live Upstream Forwarding + Local Sync & Fallback)**
   - Outbound requests proxy to `https://www.yantraaicofounder.com` using `x-api-key` and `x-ticket-token`, synchronize the resulting ticket and conversation thread into FoodHub's local database, and fall back seamlessly to local Ticketing Agent processing if the upstream service is unreachable or returns a non-2xx error.
   - Full support for all 7 documented endpoints:
     - `POST /api/external/ticketing/tickets` (`x-api-key`)
     - `GET /api/external/ticketing/tickets/:ticketNumber` (`x-api-key` + `x-ticket-token` or `?apiKey=` / `?accessToken=`)
     - `GET /api/external/ticketing/tickets/:ticketNumber/messages?since=...` (`x-api-key` + `x-ticket-token` or `?apiKey=` / `?accessToken=`)
     - `POST /api/external/ticketing/tickets/:ticketNumber/messages` (`x-api-key` + `accessToken` in body; reopens resolved tickets and triggers agent response)
     - `GET /api/external/ticketing/widget-config` (`x-api-key`)
     - `GET /api/external/ticketing/widget.js` (no key required; reads `data-api-key` attribute from script tag)
     - `POST /api/tickets/submit` (`x-api-key`, legacy intake compatibility endpoint without browser CORS preflight)
3. **Webhooks (`ticket.created`, `ticket.message`, `ticket.status_changed`, `ticket.resolved`)**
   - Webhook receivers listening at `/api/webhooks/yantra`, `/api/webhooks/yantra/tickets`, and `/api/yantra/tickets`.
   - Raw-body HMAC-SHA256 verification (`X-Yantra-Signature: t=<unix-seconds>,v1=<hex-hmac>`), 5-minute replay protection window, idempotency on `X-Yantra-Delivery`, out-of-order event state protection, 5-consecutive-failure circuit-breaker pause state (pauses for 5 minutes until a test or valid delivery succeeds), and a 30-day delivery log.

```
+-----------------------------------------------------------------------------------+
|                              FOODHUB APPLICATION                                  |
+-----------------------------------------+-----------------------------------------+
|       WORKSPACE 1: CUSTOMER APP         |       WORKSPACE 2: ADMIN CONSOLE        |
|  - Floating Yantra Support Widget       |  - /admin/support Ticketing & Webhooks  |
|  - /customer/support Support Center     |  - Live Ticket Queue & Agent Responder  |
|  - Order-Linked & General Issue Intake  |  - API Key Rotation & Webhook Config    |
|  - Incremental ?since= Message Polling  |  - Interactive E2E API/Webhook Tester   |
+--------------------+--------------------+--------------------+--------------------+
                     |                                         |
                     v                                         v
+-----------------------------------------------------------------------------------+
|                  YANTRA TICKETING API & WEBHOOK GATEWAY LAYER                     |
|  - Auth: x-api-key / ?apiKey= & Key-Derived accessToken (x-ticket-token)          |
|  - Rate Limiter: 10 req/min per IP, 300 req/min per API key (429 + Retry-After)   |
|  - CORS: Access-Control-Allow-Origin: * on /api/external/ticketing/*              |
|  - Webhook Verifier: Raw Body HMAC-SHA256 + Delivery Idempotency + 5-Fail Pause   |
+--------------------+-----------------------------------------+--------------------+
                     |                                         |
        1. Live Upstream Forward                  2. Local Sync & Fallback Store
                     v                                         v
+----------------------------------------+   +--------------------------------------+
|  https://www.yantraaicofounder.com     |   |   FoodHub Persistent State & Logs    |
|  - /api/external/ticketing/*           |   |   - Tickets & Public/Internal Msgs   |
|  - /api/tickets/submit                 |   |   - Access Tokens & Customer Mapping |
+----------------------------------------+   +--------------------------------------+
```

---

## 2. Design & Visual Direction

- **Aesthetic Persona**: High-Craft Light Mode for the **Customer App Support Center** (`#FAF8F5` warm stone canvas, `#FFFFFF` cards, `#E84A27` FoodHub vermilion primary accents, `1px solid #E2E8F0` borders) paired with Neo-Brutalist Swiss Grids for the **Admin Console Ticketing & Webhook Center** (`#F8FAFC` slate surface, high-density tabular rows, `JetBrains Mono` / `tabular-nums` for ticket numbers, HMAC signatures, delivery IDs, HTTP status codes, and timestamps).
- **Status & Semantic Badges**:
  - `open`: Amber (`#D97706`)
  - `in_progress`: Blue (`#2563EB`)
  - `waiting_on_customer`: Purple (`#7C3AED`)
  - `resolved` / `200 OK`: Emerald (`#16A34A`)
  - `failed` / `401` / `429`: Crimson (`#DC2626`)
- **Layout Density & Scannability**:
  - **Customer Support Center (`/customer/support`)**: Split-pane layout with "Raise a Ticket / My Active Tickets" on the left and the real-time conversation thread + linked order summary on the right.
  - **Admin Yantra Console (`/admin/support`)**: 4 structured sub-tabs (*Live Ticket Queue*, *Webhook Delivery Log*, *Integration & Key Config*, and *End-to-End Test Bench*) with zero nested card clutter and instant one-click verification controls.

---

## 3. Core Functional Workflows

### A. Authentication, Key-Derived Access Tokens & Rate Limiting
- **API Key Resolution**: Accept the Yantra API key from either `x-api-key` request header or `?apiKey=` query parameter. Verify that `db.yantraConfig.enabled` is active and the key matches `db.yantraConfig.apiKey` (returning `401` if rotated or invalid).
- **Key-Derived `accessToken`**: Derive each ticket's `accessToken` using `HMAC-SHA256(apiKey, ticketId + ":" + ticketNumber)` prefixed with `ytok_`. Rotating the API key in the Admin Console immediately invalidates all previously issued ticket tokens while preserving email/admin visibility, matching the Yantra specification.
- **Token Transmission**:
  - `GET /api/external/ticketing/tickets/:ticketNumber` and `GET .../messages`: Accept `x-ticket-token` header or `?accessToken=` query parameter.
  - `POST /api/external/ticketing/tickets/:ticketNumber/messages`: Accept `accessToken` in the JSON request body (as well as `x-ticket-token` header fallback).
- **Rate Limiting**:
  - Enforce sliding-window limits on `POST /api/external/ticketing/tickets`, `POST /api/tickets/submit`, and `POST /api/external/ticketing/tickets/:ticketNumber/messages`: **10 requests per caller IP per 60 seconds** and **300 requests per API key per 60 seconds**.
  - When exceeded, return HTTP `429 Too Many Requests` with the `Retry-After` header in seconds.
  - `GET` requests (reading a ticket or polling messages) are never counted against rate limits.
- **Browser CORS Policy**:
  - All `/api/external/ticketing/*` routes respond to `OPTIONS` preflight and include `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type, x-api-key, x-ticket-token`, and `Access-Control-Allow-Methods: GET, POST, OPTIONS` without reading or sending cookies.
  - `POST /api/tickets/submit` operates as a server-to-server/legacy intake route without browser preflight headers.

### B. Hybrid Upstream Forwarding + Local Synchronization
- When raising a ticket, fetching ticket status, polling messages (`?since=`), or posting a customer reply:
  1. Forward the request to `https://www.yantraaicofounder.com` with the configured `x-api-key` and `x-ticket-token` (5-second timeout).
  2. If upstream responds with 2xx, synchronize the upstream `ticketNumber`, `accessToken`, `status`, and `messages` into FoodHub's persistent store so both Customer App and Admin Console reflect the live upstream state.
  3. If upstream is unreachable or returns an error, execute the local Yantra Ticketing Agent responder (grounding answers in the customer's order status, payment method, and issue category), persist locally, and emit the corresponding signed webhook event (`ticket.created`, `ticket.message`, `ticket.status_changed`, `ticket.resolved`).

### C. Webhook Processing, Security & Delivery Rules
- **Supported Routes**: `/api/webhooks/yantra`, `/api/webhooks/yantra/tickets`, and `/api/yantra/tickets`.
- **Signature Verification**:
  - Parse `X-Yantra-Signature: t=<unix-seconds>,v1=<hex-hmac>`.
  - Compute `HMAC-SHA256(webhookSecret, "${t}.${rawBody}")` on the raw request body using `crypto.timingSafeEqual`.
  - Reject missing/invalid signatures or timestamps older than 300 seconds with HTTP `401`.
- **Delivery Guarantees**:
  - **Idempotency**: Deduplicate events by `X-Yantra-Delivery` (or payload `id`); duplicate deliveries return `200 OK` with `{ duplicate: true }` without re-applying mutations.
  - **Out-of-Order Protection**: Compare the event timestamp against the ticket's `lastWebhookEventAt` so an older `ticket.status_changed` event never overwrites a newer `ticket.resolved` state.
  - **Internal Note Privacy**: Never emit or ingest internal team notes (`isInternal: true`) over `ticket.message` webhooks.
  - **5-Failure Circuit Breaker Pause**: Track consecutive failed webhook deliveries (`webhookConsecutiveFailures`). After 5 consecutive failures, pause automated webhook dispatches for 5 minutes (`webhookPausedUntil`). A successful delivery or an explicit Admin test delivery immediately clears the pause state.

### D. Customer App & Admin Console Integration
- **Customer App (`/customer/*` & `/customer/support`)**:
  - Add a **Support** navigation item in the Customer header and a dedicated `/customer/support` Support Center page alongside the floating `YantraSupportWidget` launcher on all Customer pages.
  - Customers can raise tickets linked to a specific order or general account/checkout issues, view all their tickets, poll new replies incrementally via `?since=`, and send follow-up replies (which automatically reopen `resolved` tickets to `in_progress`).
- **Admin Console (`/admin/support`)**:
  - Add a **Yantra Support & Webhooks** module to the Admin Console sidebar.
  - **Ticket Queue & Agent Responder**: View all customer tickets, filter by status/priority/category, post public team replies or private internal notes (verifying internal notes never trigger `ticket.message` webhooks), and mark tickets `resolved` with resolution notes.
  - **Configuration & Key Rotation**: Inspect/update the Yantra API key, rotate the key with one click (demonstrating token invalidation), configure the webhook signing secret, and copy the embeddable widget snippet.
  - **End-to-End Interactive Test Bench**: One-click test runners to execute and inspect live responses for:
    1. `POST /api/external/ticketing/tickets` (Raise Ticket)
    2. `GET /api/external/ticketing/tickets/:ticketNumber` (Fetch Ticket + Token Auth)
    3. `GET /api/external/ticketing/tickets/:ticketNumber/messages?since=...` (Incremental Poll)
    4. `POST /api/external/ticketing/tickets/:ticketNumber/messages` (Customer Reply & Reopen Resolved Ticket)
    5. `POST /api/tickets/submit` (Legacy Intake Endpoint)
    6. Webhook Event Simulators (`ticket.created`, `ticket.message`, `ticket.status_changed`, `ticket.resolved`, Duplicate Delivery Idempotency, Out-of-Order Event, Invalid HMAC Signature `401`, and 5-Failure Pause/Resume).

---

## 4. Verification & End-to-End Testing Plan

1. **Automated Build & Type Verification**: Run `lint_applet` and `compile_applet` to ensure zero TypeScript or Next.js build issues.
2. **End-to-End API & Webhook Verification**: Verify all 7 Ticketing REST endpoints, CORS preflight headers, rate-limit `429` + `Retry-After` behavior, key-derived `accessToken` rotation invalidation, and HMAC-SHA256 webhook verification across both Customer and Admin workspaces.
