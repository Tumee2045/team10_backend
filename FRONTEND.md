# Frontend guide

How to build the frontend against this API. Swagger is the reference for every endpoint and field. This guide covers what Swagger doesn't: how the pieces fit together.

> ⚠️ **Do not change the backend code.** That includes the code, database, `.env`, Render settings and this repo.
> If you need something (a new endpoint, an extra field, a bug fix, a CORS origin for your port or deployed URL), **ask the backend owner ([@Tumee2045](https://github.com/Tumee2045)).** Include:
>
> - what you need and for which screen;
> - for bugs: the request you sent (method, URL, body) and the full response body.

## 1. URLs

|                              | Hosted                                              | Local backend                    |
| ---------------------------- | --------------------------------------------------- | -------------------------------- |
| API base                     | `https://team10-backend-wdhj.onrender.com/api`      | `http://localhost:3000/api`      |
| Swagger (try every endpoint) | `https://team10-backend-wdhj.onrender.com/api/docs` | `http://localhost:3000/api/docs` |
| WebSocket                    | `https://team10-backend-wdhj.onrender.com`          | `http://localhost:3000`          |

Put the base URLs in env variables, e.g. Vite `.env`:

```env
VITE_API_URL=https://team10-backend-wdhj.onrender.com/api
VITE_WS_URL=https://team10-backend-wdhj.onrender.com
```

- **CORS:** the backend only accepts requests from allowed origins. `http://localhost:5173` (the Vite default) is allowed. If you use another port, or once the frontend is deployed, tell the backend team the URL.
- **Cold start:** the hosted server is on a free plan and sleeps after 15 minutes without traffic. The first request after that takes **~1 minute**. Show a loading state; don't treat a slow first request as an error.

## 2. Response format (every endpoint)

Every response has the same shape, so you can write one helper and use it everywhere.

```ts
// success
{ success: true, statusCode: 200, message: "Listing created", data: { ... } }

// paged list: data is the array, meta has the paging info
{ success: true, statusCode: 200, message: "Success", data: [ ... ],
  meta: { total: 42, page: 1, limit: 20, totalPages: 3 } }

// error
{ success: false, statusCode: 409, error: "CONFLICT",
  message: "You already have a pending request for this listing",
  path: "/api/rental-requests", timestamp: "2026-10-28T08:00:00.000Z" }

// validation error: one entry per invalid field
{ success: false, statusCode: 400, error: "VALIDATION_ERROR", message: "Validation failed",
  errors: [{ field: "email", message: "email must be an email" }], ... }
```

`error` is always one of: `BAD_REQUEST`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

- `message` on success is safe to show in a toast (e.g. "Listing created").
- `message` on error is in English and meant for developers. Show your own Mongolian text based on `error` and the screen. For `VALIDATION_ERROR`, show `errors[].message` next to the matching form field.

**Data types**

- IDs and money (MNT) are plain numbers: `monthlyRent: 1500000`.
- `areaM2`, `latitude` and `longitude` are numbers.
- Dates are ISO strings. Send date-only fields (`availableFrom`, `startDate`) as `"YYYY-MM-DD"`.

## 3. A small API client (copy this)

```ts
// src/api/client.ts
const API = import.meta.env.VITE_API_URL;

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface ApiOk<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: PageMeta;
}
export interface ApiFail {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  constructor(public body: ApiFail) {
    super(body.message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiOk<T>> {
  const token = localStorage.getItem('token');
  const isForm = options.body instanceof FormData;
  const res = await fetch(API + path, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }), // let the browser set multipart boundaries
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await res.json()) as ApiOk<T> | ApiFail;
  if (!body.success) {
    if (body.statusCode === 401) localStorage.removeItem('token'); // expired or invalid → log out
    throw new ApiError(body);
  }
  return body;
}

// usage
const { data: districts } =
  await api<{ id: number; name: string }[]>('/districts');
const { data: listing } = await api('/listings', {
  method: 'POST',
  body: JSON.stringify(form),
});
```

## 4. Auth

1. `POST /auth/register` `{ email, password, fullName, phone? }` or `POST /auth/login` `{ email, password }`.
   Both return `data: { accessToken, user }`.
2. Save `accessToken` (e.g. `localStorage`) and send it as `Authorization: Bearer <token>`.
3. On app start, if a token exists, call `GET /users/me` to load the user. A 401 means the token expired (after 7 days), so send the user to login.
4. Logout: delete the token. There is no logout endpoint.

Password: 8–72 characters. Phone: 8–15 digits. Email is case-insensitive.

**Public routes (no token needed):** `GET /listings`, `GET /listings/map`, `GET /listings/:id`, `GET /districts`, `GET /amenities`, `GET /users/:id`, `GET /users/:id/reviews`, `/auth/*`. Everything else needs a token. If you send a token to a public route anyway, the response includes per-user fields like `isFavorite`.

## 5. Screens → endpoints

### Home / search

- Filter dropdowns: `GET /districts`, `GET /amenities`. Load once and cache.
- Results: `GET /listings?listingType=RENT&propertyType=APARTMENT&districtIds=1,3&minPrice=500000&maxPrice=2000000&rooms=2&amenityIds=1,4&q=13-р хороолол&sort=newest&page=1&limit=20`
  - All filters are optional. `rooms` = **at least** this many rooms. `amenityIds` = the listing must have **all** of them.
  - `minPrice` / `maxPrice` apply to monthly rent for RENT and sale price for SALE.
  - `sort`: `newest` | `price_asc` | `price_desc` | `popular`. `limit` max 50.
  - Each item has `coverUrl` (may be `null`, so show a placeholder), `district { id, name }`, and `isFavorite` when logged in.

### Map

- `GET /listings/map?minLat=..&maxLat=..&minLng=..&maxLng=..` plus the same filters as search. Returns up to 500 lightweight pins (no paging).
- Send all four bounds or none. Reload when the map stops moving (debounce ~300 ms).

### Listing detail

- `GET /listings/:id` returns everything: `photos[]` (first = cover), `amenities[]`, `district`, `owner { id, fullName, avatarUrl, phone }`, `isOwner`, `isFavorite`.
- Show owner actions (edit, status, delete) when `isOwner` is true.
- Owner profile link: `GET /users/:id` (with rating) and `GET /users/:id/reviews`.

### Post a listing (Зар нийтлэх)

1. `POST /listings` with JSON. Required: `listingType`, `propertyType`, `title`, `districtId`, `areaM2`, `latitude`, `longitude`, plus `monthlyRent` for RENT or `salePrice` for SALE.
   Add `publish: true` to post immediately; otherwise it's saved as a **DRAFT**.
2. Take the new `data.id` and upload photos:
   ```ts
   const fd = new FormData();
   files.forEach((f) => fd.append('files', f)); // field name must be "files"
   await api(`/listings/${id}/photos`, { method: 'POST', body: fd });
   ```
   JPEG/PNG/WebP, max 5 MB each, max 20 per listing. **The first photo uploaded is the cover.**
3. Delete a photo: `DELETE /listings/:id/photos/:photoId`.

### Edit / manage my listings

- `GET /listings/mine?status=ACTIVE` shows my listings in any status, drafts included.
- `PATCH /listings/:id` takes only the fields you change. `listingType` (RENT/SALE) **can't** be changed.
- `PATCH /listings/:id/status` with `{ status }`:

  | Button                     | status     | Allowed from            |
  | -------------------------- | ---------- | ----------------------- |
  | Publish / Relist           | `ACTIVE`   | DRAFT, INACTIVE, RENTED |
  | Hide                       | `INACTIVE` | ACTIVE                  |
  | Mark as rented (RENT only) | `RENTED`   | ACTIVE, INACTIVE        |
  | Mark as sold (SALE only)   | `SOLD`     | ACTIVE, INACTIVE        |

  Anything else returns 409. Only show the buttons that make sense for the current status.

- `DELETE /listings/:id` permanently deletes the listing with its photos, requests and chats. Ask for confirmation first.

### Favorites

- `PUT /favorites/:listingId` adds, `DELETE /favorites/:listingId` removes, `GET /favorites` lists (paged). Use `isFavorite` from search and detail to draw the heart.

### Saved searches

- `POST /saved-searches` `{ name, filters: { listingType, propertyType, districtIds, minPrice, maxPrice, rooms, amenityIds } }`
- `GET /saved-searches` and `DELETE /saved-searches/:id`.
- To "open" a saved search, put its `filters` into `GET /listings?...`. There's no separate "run" endpoint.

### Rental requests (Түрээсийн хүсэлт)

- **Renter:** `POST /rental-requests` `{ listingId, startDate: "YYYY-MM-DD", months, note? }`. Only ACTIVE RENT listings, not your own; `months ≥ minMonths`; the start date can't be in the past.
  A second PENDING request on the same listing returns **409**, so show "you already sent a request".
- `GET /rental-requests/sent` (mine as renter), `GET /rental-requests/received` (on my listings). Filter with `?status=PENDING`.
- **Owner:** `POST /rental-requests/:id/approve` or `/reject` `{ reason? }`. **Renter:** `POST /rental-requests/:id/cancel`.
- Approving one request **automatically** marks the listing RENTED and rejects every other pending request on it. Refresh the list afterwards.

### Reviews

- After a request is **APPROVED**, the renter and owner can review each other once: `POST /reviews` `{ rentalRequestId, rating: 1-5, comment? }`.
- `PATCH /reviews/:id` edits your own review. A user's reviews: `GET /users/:id/reviews`.

### Chat

- "Message owner" button on a listing: `POST /conversations` `{ listingId }` returns the existing chat or a new one. Use its `id`.
- Chat list: `GET /conversations`. Each item has `listing`, `otherUser`, `lastMessage`, `unreadCount` and `myRole` (`OWNER` / `CLIENT`).
- Open a chat: `GET /conversations/:id` returns the chat plus `messages: { items, hasMore }` (oldest → newest, 50 per load).
  For older messages: `GET /conversations/:id?before=<id of the oldest loaded message>`.
- Send: `POST /conversations/:id/messages` `{ body }`.
- Mark as read: `POST /conversations/:id/read`. Opening a chat does **not** do this automatically; call it when the chat is visible.

### Notifications

- Bell badge: `GET /notifications/unread-count`. List: `GET /notifications?unreadOnly=true` (paged).
- `POST /notifications/:id/read`, `POST /notifications/read-all`.
- Each has `type`, `title`, `body` (already in Mongolian, show as-is) and `data` with ids for the link:

  | type                                                                       | Link to                                 |
  | -------------------------------------------------------------------------- | --------------------------------------- |
  | `NEW_RENTAL_REQUEST`, `RENTAL_REQUEST_APPROVED`, `RENTAL_REQUEST_REJECTED` | request `data.requestId`                |
  | `NEW_MESSAGE`                                                              | chat `data.conversationId`              |
  | `NEW_REVIEW`                                                               | your reviews / request `data.requestId` |

### Profile

- `GET /users/me`, `PATCH /users/me` `{ fullName?, phone?, bio? }`, `PATCH /users/me/password` `{ currentPassword, newPassword }`.
- Avatar: `POST /users/me/avatar` multipart with field name **`file`** (single file).

## 6. Real-time (WebSocket)

Chat messages and notifications arrive live over socket.io. **The socket only receives.** Sending messages and marking chats as read still go through the REST endpoints above.

```ts
// npm i socket.io-client
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_WS_URL, { auth: { token } }); // connect after login

socket.on('message:new', ({ conversationId, message }) => {
  // append to the open chat, or bump that chat in the list / unread badge
  // also sent to the sender's other tabs, so dedupe by message.id
});
socket.on('conversation:read', ({ conversationId, userId, readAt }) => {
  // the other person has read the chat → show "seen"
});
socket.on('notification:new', (notification) => {
  // prepend to the list, +1 the bell badge, maybe show a toast
});

// on logout
socket.disconnect();
```

An invalid or expired token disconnects the socket immediately, so reconnect after login with the new token.

## 7. Enums

| Field            | Values                                                                |
| ---------------- | --------------------------------------------------------------------- |
| `listingType`    | `RENT`, `SALE`                                                        |
| `propertyType`   | `APARTMENT`, `HOUSE`, `GER`, `OFFICE`, `COMMERCIAL`, `GARAGE`, `LAND` |
| listing `status` | `DRAFT`, `ACTIVE`, `INACTIVE`, `RENTED`, `SOLD`                       |
| request `status` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`                        |
| user `role`      | `USER`, `ADMIN`                                                       |

Show Mongolian labels in the UI (e.g. `APARTMENT` → "Орон сууц"); always send the English values to the API.

## 8. Tips

- **Status codes you'll handle:** 400 (show field errors), 401 (go to login), 403 (not yours), 404 (not found or not yours), 409 (state conflict: show `message`, refresh the data).
- Don't calculate permissions yourself; the backend checks everything. Use `isOwner` and the status rules above only to decide **which buttons to show**.
- Use **Try it out** in Swagger to see the real response for any endpoint. Click **Authorize** and paste a token from `/auth/login` first.
- Found a bug or need an endpoint? Don't patch the backend yourself. Ask the backend owner (see the top of this guide), and work around it in the frontend until it's fixed.
