# Laptop Fix Runbook — Pampanga Home Suites

Cheat-sheet for defense-day fixes. Project lives at `C:\Users\<you>\hotel-management-system_V2` (or wherever you cloned).

---

## Quick commands

| Task | Command |
|---|---|
| Start backend | `cd backend && php artisan serve` |
| Start frontend | `cd frontend && npm run dev` |
| Run backend tests | `cd backend && php artisan test` |
| Run frontend tests | `cd frontend && npx vitest run` |
| Type-check frontend | `cd frontend && npx tsc --noEmit` |
| Build frontend | `cd frontend && npm run build` |
| Reset DB to seeded demo | `cd backend && php artisan migrate:fresh --seed` |
| Clear caches | `php artisan config:clear && php artisan cache:clear && php artisan route:clear` |
| Storage link (missing images) | `php artisan storage:link` |

---

## Live site / deploy (only works from home / allowed IP)

- SSH: `ssh -i hotel.pem ubuntu@52.20.101.14`
- Deploy: push to GitHub then `sudo bash /var/www/hotel/deploy.sh`
- Live DB (direct): `mysql -h hotel-db.citymo8cssdy.us-east-1.rds.amazonaws.com -u hotel_admin -p'PalayJc103221100' hotel_management`
- Live URLs: portal `https://pampangahomesuites.duckdns.org` · admin `/admin/login` · webhook `/api/webhooks/payment`
- **The venue Wi-Fi likely blocks SSH/RDS (port 22/3306) — the offline local replica is your primary defense setup.**

---

## Top common fixes

### 1. Images / logos broken (white diamond)
- Run `php artisan storage:link`
- Uploaded files live under `storage/app/public/`; URL served at `/storage/...`

### 2. Admin "white screen" / blank page after login
- Clear the Vite cache: delete `frontend/node_modules/.vite`, restart `npm run dev`
- Check browser console for a 500 on an API call; read `backend/storage/logs/laravel.log`

### 3. Login fails
- Seeded accounts: `admin@hotel.com` / `password` (staff); `james.smith@email.com` / `password` (guest)
- Check the account is active (`is_active=1` in `users`) and role exists (`role_id` set). Reset a password in DB:
  `UPDATE users SET password = '$2y$12$...' WHERE email='admin@hotel.com';` — easiest is re-seed: `php artisan db:seed --class=UserSeeder`

### 4. API 500 errors
- Read `backend/storage/logs/laravel.log` — the actual exception is there.
- Common: missing `.env` key (`php artisan key:generate`), missing table (`php artisan migrate`), missing storage link (#1).

### 5. Booking/rooms not showing on portal
- Portal only lists rooms with `status='available'` + `is_active=1`. If you clicked statuses around, reset all rooms:
  `php artisan tinker --execute="App\Models\Room::query()->update(['status'=>'available','is_active'=>true]);"`
- `GET /rooms?all=1` returns `{ data: [...] }` (wrapped) — the frontend expects `roomsData?.data`.

### 6. Online payment demo
- Gateway settings: Admin → Settings → **Payments** tab (`base_url=https://www.hardreset.club`, API key `REDACTED_GATEWAY_KEY`, webhook secret `REDACTED_WEBHOOK_SECRET`).
- **Allow Guest Self-Settlement** toggle must be **ON** for the demo auto-confirm to work (webhook from the partner is unreliable — that's expected).
- Pay with test card **`4242 4242 4242 4242`** (any future expiry / CVC). No real money.
- If not redirected back, visit homepage with `?booking_ref=<BK-...>&status=success` to settle.

### 7. Webhook URL (partner integration)
- Correct URL: `POST https://pampangahomesuites.duckdns.org/api/webhooks/payment` (+ `/public/api/webhooks/payment` alias).
- Header `X-Webhook-Secret: REDACTED_WEBHOOK_SECRET`. Returns `200 {"received":true}`.

### 8. Rooms page status / cleaning
- Status enum: `available, occupied, reserved, dirty, maintenance`.
- Housekeeping "New Task" room picker only lists rooms that need cleaning (`cleaning_status != clean` or `status == dirty`).

### 9. Settings tabs don't save
- Keys must be whitelisted in `backend/app/Http/Controllers/Api/SettingController.php` `ALLOWED_KEYS`. Adding a new key there + seeder makes it editable.

### 10. Migrations
- Run `php artisan migrate`. Seeder reference: `php artisan db:seed` (or `migrate:fresh --seed` to wipe + rebuild demo data).
- Idempotent index/drop migrations are safe to re-run.

---

## Quick sanity checks before demo
1. `php artisan test` → all green
2. `npx vitest run` → all green
3. Portal loads + can book
4. Admin dashboard loads
5. `php artisan storage:link` run
6. Room statuses mostly `available`
7. Gateway enabled + self-settle ON (Settings → Payments)

## Logs
- Backend: `backend/storage/logs/laravel.log`
- Frontend: browser devtools console/network
- Server: `ssh` → `sudo journalctl -u nginx -n 100` / `/var/www/hotel/backend/storage/logs/laravel.log`