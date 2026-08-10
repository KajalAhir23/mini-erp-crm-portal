
# Mini ERP + CRM Operations Portal

A small internal ERP/CRM system for a wholesale/distribution company — customers, products,
stock, and sales challans — built as a full-stack case study.

**Stack:** Node.js + TypeScript + Express + Prisma + PostgreSQL (backend) · React + TypeScript + Vite (frontend)

---

## 1. Project Structure

```
erp-crm/
├── backend/                 # Express + TypeScript API
│   ├── prisma/schema.prisma # Database schema
│   ├── src/
│   │   ├── config/db.ts     # Prisma client
│   │   ├── middleware/      # auth, validation, error handling
│   │   ├── controllers/     # business logic per module
│   │   ├── routes/          # route definitions
│   │   └── utils/           # jwt, seed script, helpers
│   └── .env.example
├── frontend/                # React + Vite admin UI
│   └── src/
│       ├── api/client.ts    # fetch wrapper with JWT
│       ├── context/         # auth state
│       ├── pages/           # Login, Dashboard, Customers, Products, Challans
│       └── components/      # Layout, ProtectedRoute
├── postman_collection.json
└── README.md (this file)
```

---

## 2. Architecture Overview

- **Auth**: JWT-based. On login, the API returns a signed token containing `userId`, `role`,
  and `email`. The frontend stores it in `localStorage` and sends it as `Authorization: Bearer <token>`.
  An `authenticate` middleware verifies the token; an `authorize(...roles)` middleware restricts
  specific routes to specific roles (e.g. only `ADMIN`/`SALES` can create customers).
- **Database**: PostgreSQL via Prisma ORM. Schema defines `User`, `Customer`, `FollowUp`,
  `Product`, `StockMovement`, `SalesChallan`, `ChallanItem` with proper relations and enums.
- **Core business rule — stock integrity**: All stock changes (direct adjustments and challan
  confirmation/cancellation) run inside a Prisma `$transaction`, check current stock before
  decrementing, and throw a `400` error if the result would go negative. This guarantees stock
  can never go below zero even under concurrent requests within the transaction.
- **Snapshotting**: `ChallanItem` stores `productName`, `productSku`, and `unitPrice` at the time
  of sale (not just a foreign key), so historical challans stay accurate even if a product is
  later renamed or repriced.
- **Challan lifecycle**: `DRAFT → CONFIRMED → CANCELLED`. Stock is only deducted on confirmation;
  cancelling a confirmed challan restores stock automatically.

---

## 3. Local Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local install, or a free hosted one — see §5)

### Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string, set a JWT_SECRET

npm install
npx prisma generate
npx prisma migrate dev --name init   # creates tables
npm run seed                          # creates 4 demo users + sample products/customers
npm run dev                           # starts API on http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
# edit .env: set VITE_API_URL to your backend URL (http://localhost:4000 for local)

npm install
npm run dev      # starts UI on http://localhost:5173
```

### Test Login Credentials (created by `npm run seed`)

| Role      | Email                  | Password      |
|-----------|-------------------------|---------------|
| Admin     | admin@erpcrm.test       | Password123!  |
| Sales     | sales@erpcrm.test       | Password123!  |
| Warehouse | warehouse@erpcrm.test   | Password123!  |
| Accounts  | accounts@erpcrm.test    | Password123!  |

---

## 4. Environment Variables

**backend/.env**
| Variable        | Description                                  |
|-----------------|-----------------------------------------------|
| `DATABASE_URL`  | PostgreSQL connection string                  |
| `JWT_SECRET`    | Random secret used to sign JWTs               |
| `JWT_EXPIRES_IN`| Token lifetime, e.g. `8h`                     |
| `PORT`          | Port the API listens on (default `4000`)      |
| `CORS_ORIGIN`   | Comma-separated allowed frontend origin(s)    |

**frontend/.env**
| Variable        | Description                        |
|-----------------|-------------------------------------|
| `VITE_API_URL`  | Base URL of the deployed/local API  |

Never commit real `.env` files — only `.env.example` is checked into git (see `.gitignore`).

---

## 5. Deployment Guide (free hosting, no AWS spend required)

This satisfies the assignment's "if not deploying to AWS, deploy to any free host" option.
AWS deployment is optional/bonus per the brief — the steps below use free tiers instead.

### Step 1 — Database (choose one)
- **Neon** (https://neon.tech) — free Postgres, easiest to set up. Create a project, copy the
  connection string into `DATABASE_URL`.
- **Supabase** or **Render Postgres** work the same way.

### Step 2 — Backend (Render, free tier)
1. Push this repo to GitHub.
2. On Render → New → Web Service → connect the repo, root directory `backend`.
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npm run prisma:deploy && npm start`
5. Add environment variables (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`
   set to your frontend's URL).
6. After first deploy, run the seed once via Render's shell: `npm run seed`.

Railway or Fly.io work the same way if you prefer those.

### Step 3 — Frontend (Vercel or Netlify, free tier)
1. Import the repo, root directory `frontend`.
2. Build command: `npm run build`, output directory: `dist`.
3. Add environment variable `VITE_API_URL` = your Render backend URL.
4. Deploy. Update the backend's `CORS_ORIGIN` to match the resulting frontend URL, then redeploy backend.

### Step 4 (Bonus) — AWS
If pursuing the AWS bonus: EC2 or Elastic Beanstalk for the backend (with an RDS Postgres
instance), and S3 + CloudFront (or Amplify) for the static frontend build. Not required for
this submission — documented here for completeness.

---

## 6. API Overview

All endpoints except `/auth/login` require `Authorization: Bearer <token>`.

| Method | Endpoint                          | Roles                          |
|--------|------------------------------------|----------------------------------|
| POST   | `/auth/login`                     | Public                          |
| GET    | `/auth/me`                        | Any authenticated user          |
| GET    | `/customers`                      | Any authenticated user          |
| GET    | `/customers/:id`                  | Any authenticated user          |
| POST   | `/customers`                      | Admin, Sales                    |
| PUT    | `/customers/:id`                  | Admin, Sales                    |
| POST   | `/customers/:id/follow-ups`       | Admin, Sales                    |
| GET    | `/products`                       | Any authenticated user          |
| GET    | `/products/:id`                   | Any authenticated user          |
| POST   | `/products`                       | Admin, Warehouse                |
| PUT    | `/products/:id`                   | Admin, Warehouse                |
| POST   | `/products/:id/movements`         | Admin, Warehouse                |
| GET    | `/challans`                       | Any authenticated user          |
| GET    | `/challans/:id`                   | Any authenticated user          |
| POST   | `/challans`                       | Admin, Sales                    |
| PATCH  | `/challans/:id/status`            | Admin, Sales, Warehouse         |

Query params: `/customers` and `/products` support `?search=`, `?page=`, `?pageSize=`;
`/products` also supports `?lowStock=true`; `/challans` supports `?status=` and `?customerId=`.

Import `postman_collection.json` into Postman for ready-made requests (login first, copy the
returned token into the collection's `token` variable).

---

## 7. Assumptions Made

- One challan confirmation reduces stock for all its line items atomically — if any single
  item has insufficient stock, the entire challan creation/confirmation is rejected (no partial
  fulfillment), per "stock should not go negative."
- Roles are fixed to the four specified (Admin, Sales, Warehouse, Accounts); Accounts currently
  has read access to all modules but no write access, since the brief didn't specify
  Accounts-specific write actions.
- Customer `email` and most secondary fields are optional to keep quick data entry realistic for
  a sales team in the field.
- Challan numbers are generated sequentially per year (`CH-2026-000001`) rather than fully random,
  for readability on physical/printed challans.

## 8. Known Limitations

- No PDF export of challans (listed as a bonus in the brief — not implemented).
- No AWS S3 image upload (bonus — not implemented).
- No automated test suite (given the 48-hour scope, manual verification + Postman collection
  were prioritized).
- Pagination is offset-based (fine at this scale); a large production dataset would benefit from
  cursor-based pagination.
=======
# mini-erp-crm-portal
