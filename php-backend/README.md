# PHP Backend (REST + WebSocket)

This folder contains a minimal PHP backend that provides:

- REST API (auth, contacts, messages, calls) via `php -S` serving `public/index.php`
- WebSocket signaling + realtime chat using Ratchet (`cboden/ratchet`)
- MySQL schema in `init.sql`

## Requirements

- PHP >= 8.0 with PDO MySQL extension
- Composer
- MySQL 5.7+ or MariaDB 10.4+

## 1) Create database and tables

```bash
mysql -u root -p < php-backend/init.sql
```

If needed, adjust database name or credentials in the SQL file first. The default DB is `whatsapp_clone`.

## 2) Configure environment

The backend reads standard env variables:

- `DB_HOST` (default `127.0.0.1`)
- `DB_PORT` (default `3306`)
- `DB_NAME` (default `whatsapp_clone`)
- `DB_USER` (default `root`)
- `DB_PASS` (default empty)
- `WS_PORT` (default `8080`)

Export them in your shell before running the servers, e.g.:

```bash
export DB_HOST=127.0.0.1
export DB_USER=root
export DB_PASS=yourpassword
export DB_NAME=whatsapp_clone
export WS_PORT=8080
```

## 3) Install PHP dependencies

```bash
cd php-backend
composer install
```

## 4) Run REST API (PHP built-in server)

From the project root:

```bash
php -S 0.0.0.0:8000 -t php-backend/public
```

The API will be available at `http://localhost:8000` with these endpoints:

- `POST /register` (phone, name, password)
- `POST /login` (phone, password) → returns token
- `GET /me` (Bearer token)
- `GET /contacts` (Bearer token)
- `POST /contacts` (Bearer token, phone)
- `GET /messages/{contactId}` (Bearer token)
- `POST /messages` (Bearer token, to, content)
- `GET /calls` (Bearer token)
- `POST /calls` (Bearer token, callee_id, status, started_at?, ended_at?)

CORS is enabled for development by default in `public/index.php`.

## 5) Run WebSocket server

In another terminal:

```bash
cd php-backend
php websocket/server.php
```

The server listens on `ws://localhost:${WS_PORT:-8080}`.

## 6) Wire up the Next.js app

Create a `.env.local` in the project root (or copy from `.env.local.example`) so the UI knows where to connect:

```env
NEXT_PUBLIC_PHP_API_BASE=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

Then start Next.js as usual:

```bash
npm run dev
```

Open http://localhost:3000 — you can:

1. Register two users (phone + password; name on register)
2. Log in as user A
3. Add user B by phone in the left panel
4. Select B and start chatting
5. Open another browser/incognito window, log in as user B to see realtime messages
6. Try calling using the Call button (webcam/mic permission required). Signaling is via WebSocket; call history is saved via REST.

## Notes

- WebSocket server forwards messages to the targeted user and persists chat messages when type is `chat`.
- For production, put the REST API behind a proper web server (Nginx/Apache) and use HTTPS + WSS.
- You can implement message delivery/read receipts by updating `messages.status` on read events.