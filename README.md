# Backend — Үл хөдлөх хөрөнгө түрээслэх, зарах платформ

NestJS 11 · PostgreSQL · Prisma 6 · JWT · Cloudinary

> **Frontend developers:** start with [FRONTEND.md](FRONTEND.md). It covers URLs, the response format, auth, every screen's endpoints and WebSocket.

## Setup

Requirements: Node 20+ and PostgreSQL 14+ running locally.

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in DATABASE_URL, JWT_SECRET, Cloudinary keys
createdb -U postgres real_estate   # or create it in pgAdmin

npm run db:migrate          # creates all tables
npm run db:seed             # districts, amenities, admin account
npm run start:dev           # http://localhost:3000/api
```

API docs (Swagger), where you can try every endpoint: **http://localhost:3000/api/docs**
To call protected routes, use `POST /api/auth/login`, copy `accessToken` and click **Authorize**.

Seeded admin: `admin@example.com` / `Admin12345`. You can change these with `SEED_ADMIN_*` in `.env`.

## Scripts

| Script                               | What it does                                              |
| ------------------------------------ | --------------------------------------------------------- |
| `npm run start:dev`                  | Run with hot reload                                       |
| `npm run build` / `start:prod`       | Compile to `dist/` and run                                |
| `npm run db:migrate`                 | Apply pending migrations (`prisma migrate deploy`)        |
| `npm run db:migrate:dev -- --name x` | After editing `schema.prisma`: create a new migration     |
| `npm run db:seed`                    | Upsert lookup data and the admin account. Safe to re-run. |
| `npm run db:reset`                   | **Drops everything**, re-migrates and re-seeds            |
| `npm run db:studio`                  | Prisma Studio (DB browser)                                |
| `npm test` / `npm run test:e2e`      | Unit tests / e2e tests (e2e needs a seeded DB)            |
| `npm run lint`                       | ESLint + Prettier                                         |

## Deploy (free: Render + Neon)

- **Database:** [Neon](https://neon.com) Postgres. Use the **direct** connection string (not the `-pooler` one), with `?sslmode=require`.
- **API:** [Render](https://render.com) free web service, configured by [`render.yaml`](render.yaml) (Render → New → Blueprint).
  - Build: `npm ci && npm run build`
  - Start: `npm run start:deploy`. On every deploy this applies migrations, upserts the lookups and admin, then starts the API.
  - Health check: `/api/health`
- Free instances sleep after 15 min without traffic, so the first request afterwards takes ~1 min.
- `CORS_ORIGINS` must list every frontend origin (e.g. `http://localhost:5173`), for both REST and WebSocket.

## Structure

```
prisma/
  schema.prisma          ← mirrors docs/erd.dbml (snake_case tables via @@map)
  migrations/…_init/     ← generated SQL + hand-written CHECKs / partial index
  seed.ts
src/
  main.ts                ← /api prefix, validation, CORS, Swagger
  app.module.ts          ← global JWT + roles guards
  common/                ← decorators (@Public, @Roles, @CurrentUser), guards, pipes, filters
  prisma/  cloudinary/   ← shared services
  auth/  users/  lookups/  listings/  favorites/  saved-searches/
  rental-requests/  conversations/  reviews/  notifications/
```

Each feature folder has `*.controller.ts` (HTTP), `*.service.ts` (business rules and Prisma) and `dto/` (validated input).

## Endpoints

Every path starts with `/api`. 🔓 = works without a token.

| Area            | Endpoints                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth            | 🔓 `POST /auth/register`, 🔓 `POST /auth/login` → `{ accessToken, user }`                                                                                                                                 |
| Users           | `GET/PATCH /users/me`, `PATCH /users/me/password`, `POST /users/me/avatar`, 🔓 `GET /users/:id`, 🔓 `GET /users/:id/reviews`                                                                              |
| Lookups         | 🔓 `GET /districts`, 🔓 `GET /amenities`                                                                                                                                                                  |
| Listings        | 🔓 `GET /listings` (search), 🔓 `GET /listings/map`, 🔓 `GET /listings/:id`, `GET /listings/mine`, `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id`                                        |
| Listing status  | `PATCH /listings/:id/status` with `{ status: ACTIVE \| INACTIVE \| RENTED \| SOLD }`                                                                                                                      |
| Photos          | `POST /listings/:id/photos` (multipart `files`; the first photo is the cover), `DELETE /listings/:id/photos/:photoId`                                                                                     |
| Favorites       | `GET /favorites`, `PUT /favorites/:listingId`, `DELETE /favorites/:listingId`                                                                                                                             |
| Saved searches  | `GET/POST /saved-searches`, `DELETE /saved-searches/:id`. Stores named filters; run them with `GET /listings?…`                                                                                           |
| Rental requests | `POST /rental-requests`, `GET /rental-requests/sent`, `GET /rental-requests/received`, `GET /rental-requests/:id`, `POST …/:id/approve`, `…/reject`, `…/cancel`                                           |
| Chat            | `POST /conversations` (open with listing owner), `GET /conversations`, `GET /conversations/:id` (with messages, `?before=` for older), `POST /conversations/:id/messages`, `POST /conversations/:id/read` |
| Reviews         | `POST /reviews`, `PATCH /reviews/:id`                                                                                                                                                                     |
| Notifications   | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`                                                                                   |
| Health          | 🔓 `GET /health`                                                                                                                                                                                          |

### Search query params (`GET /listings`, `/listings/map`)

`listingType`, `propertyType`, `districtIds=1,2`, `minPrice`, `maxPrice`, `rooms` (minimum),
`amenityIds=1,3` (listing must have all of them), `minArea`, `maxArea`, `q` (text search),
`minLat,maxLat,minLng,maxLng` (map box, send all four or none), `sort=newest|price_asc|price_desc|popular`, `page`, `limit` (max 50).

## Business rules

- **Listing status** (`PATCH /listings/:id/status`): `DRAFT/INACTIVE/RENTED → ACTIVE` (publish) · `ACTIVE → INACTIVE` (hide) · `ACTIVE/INACTIVE → RENTED` (RENT only) or `→ SOLD` (SALE only). Anything else → **409**.
  The listing type (RENT/SALE) can't be changed after creation.
  The public can only open ACTIVE, RENTED and SOLD listings. DRAFT and INACTIVE are visible to the owner and admins only.
- **Price:** a RENT listing needs `monthlyRent`, a SALE listing needs `salePrice`. Fields that don't fit the listing type are cleared. The database enforces this too.
- **Rental request:** only for ACTIVE RENT listings that aren't your own. `months ≥ minMonths`, and the start date can't be in the past.
  Only one PENDING request per (listing, renter) is allowed; a second one returns **409**. Only the owner can approve or reject; only the renter can cancel.
  **Approving** marks the listing RENTED and automatically rejects every other PENDING request on it
  (reason: "Зар өөр хүнд түрээслэгдсэн"), and those renters are notified. To rent it out again, the owner sets the status back to `ACTIVE`.
- **Reviews:** only after an APPROVED request. The renter and owner each review the other once (rating 1–5).
- **Chat:** one conversation per (listing, interested user). Unread count = the other person's messages after your `*_last_read_at`. A recipient gets at most one unread `NEW_MESSAGE` notification per conversation.
- **Admin:** can view and delete any listing, and can set any listing to `INACTIVE`.

## API conventions

- Auth header: `Authorization: Bearer <token>`. Tokens last `JWT_EXPIRES_IN` (default 7d).
- IDs and MNT amounts are `bigint` in the DB but come back as plain JSON numbers. Decimals (area, coordinates) are numbers too.
- Unknown fields in the body or query → **400** (`forbidNonWhitelisted`).

### Real-time (WebSocket)

Chat messages and notifications are pushed over socket.io on the same port as the API. Connect with the same JWT:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', { auth: { token: accessToken } });

socket.on('message:new', ({ conversationId, message }) => {}); // to both participants
socket.on('conversation:read', ({ conversationId, userId, readAt }) => {}); // "seen", to the other participant
socket.on('notification:new', (notification) => {}); // to its owner
```

The socket is receive-only: sending messages and marking them as read still go through REST.
An invalid or missing token disconnects the socket.

### Response format

Every response, success or error, has the same top-level shape:

```jsonc
// success
{ "success": true,  "statusCode": 200, "message": "Listing created", "data": { ... } }
// paged list: data is the array, meta has the paging info
{ "success": true,  "statusCode": 200, "message": "Success", "data": [ ... ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 } }
// error
{ "success": false, "statusCode": 409, "error": "CONFLICT",
  "message": "You already have a pending request for this listing", "path": "...", "timestamp": "..." }
// validation error
{ "success": false, "statusCode": 400, "error": "VALIDATION_ERROR", "message": "Validation failed",
  "errors": [{ "field": "email", "message": "email must be an email" }], "path": "...", "timestamp": "..." }
```

`error` is one of: `BAD_REQUEST`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`PAYLOAD_TOO_LARGE`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.
A chat (`GET /conversations/:id`) loads older messages by message id instead of page numbers: `data.messages` is `{ items, hasMore }`.
Opening a chat does not mark it as read. Call `POST /conversations/:id/read` for that.

The code standard is in [CONTRIBUTING.md](CONTRIBUTING.md).
