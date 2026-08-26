# Laptop Setup Guide — Pampanga Home Suites

Step-by-step to run the full system on your laptop (offline-capable). Total time ~30–45 min.

> Prereqs summary: **Git, PHP 8.3+, Composer, Node 20 LTS, XAMPP (MySQL)**. All free.

---

## 1. Install the tools

| Tool | What for | How |
|---|---|---|
| Git | clone repo | https://git-scm.com/download/win |
| PHP 8.3+ | Laravel backend | https://windows.php.net/download/ (x64 Non-thread-safe, e.g. 8.5.x) — enable extensions in `php.ini`: `mbstring`, `pdo_mysql`, `pdo_sqlite`, `openssl`, `curl`, `fileinfo`, `gd`; also set `curl.cainfo`/`openssl.cafile` if you get SSL errors (see `C:\xampp\php\extras\ssl\cacert.pem`) |
| Composer | PHP deps | https://getcomposer.org/download/ |
| Node 20 LTS | React frontend | https://nodejs.org/ (LTS) |
| XAMPP | MySQL database | https://www.apachefriends.org/ |

After installing, verify from a terminal:
```
php -v        # PHP 8.3+
composer -V
node -v       # v20+
git --version
```

---

## 2. Get the code

```
git clone https://github.com/DarkSelion/hotel-management-system_V2
cd hotel-management-system_V2
```

---

## 3. Start MySQL and create the database

1. Open **XAMPP Control Panel** → start **MySQL**.
2. Open http://localhost/phpmyadmin → **New** → database name **`hotel_management`**, collation `utf8mb4_unicode_ci`.

---

## 4. Backend setup

```
cd backend
copy .env.example .env
php artisan key:generate
php artisan storage:link
```

Then edit **`backend\.env`** — set these to your local MySQL (leave everything else as-is):

```env
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=hotel_management
DB_USERNAME=root
DB_PASSWORD=
```

### Option A — Seeded demo data (recommended default)
```
php artisan migrate --seed
```

### Option B — Exact live copy (matches production)
Use the live dump from the USB bundle (`laptop_bundle\database\live_dump.sql`) instead:
```
mysql -u root hotel_management < laptop_bundle\database\live_dump.sql
php artisan migrate
```
(Live data: real guests/bookings/settings. Restores exactly what the live site has.)

---

## 5. Frontend setup

```
cd frontend
npm install
```

---

## 6. Run it

Terminal 1 (backend):
```
cd backend
php artisan serve
```

Terminal 2 (frontend):
```
cd frontend
npm run dev
```

Open **http://localhost:5173** → portal. Admin at **http://localhost:5173/admin** (or the SPA's `/admin/login`).

### Logins (seeded)
- Admin: `admin@hotel.com` / `password` (full admin)
- Receptionist: `reception@hotel.com` / `password`
- Guest portal: `james.smith@email.com` / `password` (or register your own)

---

## 7. Tests (verify everything works)

```
cd backend && php artisan test
cd frontend && npx vitest run && npx tsc --noEmit
```

---

## 8. (Optional) opencode with your chat history

1. Install opencode: `npm i -g opencode-ai`
2. Copy the opencode data from the USB bundle into place (close opencode first):
   - `laptop_bundle\opencode\share` → `C:\Users\<you>\.local\share\opencode`
   - `laptop_bundle\opencode\config` → `C:\Users\<you>\.config\opencode`
3. Run `opencode` in the project folder — your sessions/history load.

---

## 9. Verify checklist
- [ ] Portal loads with hero + rooms
- [ ] Book a room → appears in My Reservations
- [ ] Admin login works → Dashboard shows stats
- [ ] `php artisan test` green
- [ ] `npx vitest run` green

If something fails, see **`LAPTOP_FIX_RUNBOOK.md`**.