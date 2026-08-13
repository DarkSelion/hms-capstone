# Pampanga Home Suites — Hotel Management & Booking System
## Comprehensive System Documentation (Capstone Project)

---

# Table of Contents

1. [System Overview](#chapter-1-system-overview)
2. [Technology Stack & Architecture](#chapter-2-technology-stack--architecture)
3. [Database Design](#chapter-3-database-design)
4. [Core Features & Business Logic](#chapter-4-core-features--business-logic)
5. [Security](#chapter-5-security)
6. [Testing & QA](#chapter-6-testing--qa)
7. [Setup, Deployment & Operation](#chapter-7-setup-deployment--operation)
8. [Known Limitations & Future Work](#chapter-8-known-limitations--future-work)
9. [Appendix A — Full Route Table](#appendix-a--full-route-table)
10. [Appendix B — Settings Keys](#appendix-b--settings-keys)

---

# Chapter 1. System Overview

## 1.1 Purpose

**Pampanga Home Suites** (rebranded from *Grand Luxe Hotel*) is a hotel management and online room-booking system built for a small boutique property of roughly **fifteen (15) rooms** located in Pampanga, Philippines. The system solves a real operational need: a small hotel cannot justify the cost or complexity of enterprise Property Management Systems (PMS), yet it still needs to manage reservations, front-desk check-in/check-out, payments, housekeeping, maintenance, staff scheduling, and reporting in a coordinated way. The project is delivered as a single codebase that hosts **two distinct applications** sharing one API:

| Application | Audience | Purpose |
|---|---|---|
| **Guest Portal** | Public visitors & registered guests | Marketing, room browsing, online booking, self-service payments, contact form |
| **Admin Dashboard** | Hotel staff (reception, housekeeping, cashier, management) | All day-to-day operations, reporting, and configuration |

The system is designed around the daily rhythm of a small hotel: a guest books (online or at the front desk), staff check the guest in, housekeeping turns rooms, maintenance fixes issues, and management reviews revenue and occupancy. Every meaningful action is recorded in an activity log so the hotel always has an audit trail.

## 1.2 What the system does

**For guests (public portal):**

- Browse a public catalog of room types (Standard, Deluxe, Junior Suite, Executive Suite, Penthouse, Family Room) with real photos, descriptions, and nightly rates.
- Search availability for any date range; see which room types still have rooms and how many are left.
- Register an account and log in to the portal.
- Book a room by room type — the system automatically assigns the first available physical room of that type at booking time.
- View their reservation history, cancel eligible reservations, and make payments online (recorded as cash or GCash).
- Update their profile, change their password, or delete their account.
- Submit inquiries through a contact form with a honeypot anti-spam field.

**For staff (admin dashboard):**

- Dashboard with key performance indicators: today's revenue, occupancy rate, check-ins/check-outs today, pending reservations, and a 30-day revenue/bookings trend chart.
- Full reservation lifecycle: create, edit, check in, check out, cancel, mark no-show, and detect overdue (no-show risk) reservations.
- Front-desk payment collection (cash with tender/change, GCash recorded as pending), with enforcement rules that prevent checking out with an unsettled balance.
- Guest management (CRM-style profiles, VIP / blacklist flags, stay history).
- Room and room-type management, including room images and amenities.
- Housekeeping task tracking with assignment, priority, and completion flow.
- Maintenance request tracking with photos, cost estimates, and assignment.
- Staff management: roles, schedules, leave requests.
- Billing: invoicing with line items, invoice status workflow, and printable PDF invoices.
- Expense recording.
- Revenue / occupancy / reservation reports with CSV export.
- System settings (hotel identity, tax, booking policy, contact info, security options) and hotel logo upload.
- Contact-message (Inquiries) inbox fed by the portal contact form.
- Global activity log and a cross-module search.

## 1.3 Roles and the access model

The system defines **seven staff roles** plus one implicit guest role. Authorization is enforced twice: at the **API layer** by the `role` middleware, and at the **UI layer** by route guards and button-level visibility helpers. The roles and the effective permission groups used by the middleware are:

| Role slug | Display name | Middleware group |
|---|---|---|
| `super_admin` | Super Admin | `admin` |
| `admin` | Admin | `admin` |
| `hotel_manager` | Hotel Manager | `admin` |
| `receptionist` | Receptionist | `staff` |
| `housekeeping` | Housekeeping | `staff` |
| `cashier` | Cashier | `staff` |
| `staff` | Staff | `staff` |
| *(portal account)* | Guest | `guest` |

A granular permission table (`roles → role_permission → permissions`) exists and is seeded per role, but the **runtime authorization** for API endpoints uses the simpler tier collapse described in Chapter 5. The permission records remain useful as a human-readable map of what each role is conceptually allowed to do.

## 1.4 A note on naming

The front desk still logs into a screen branded for the hotel, but the *public* portal has been fully rebranded to **"Pampanga Home Suites."** All public-facing copy, contact details, and the footer reflect the new brand. Administrative surfaces intentionally retain the internal brand mark. See Appendix B for the configurable settings that drive branding.

---

# Chapter 2. Technology Stack & Architecture

## 2.1 Technology stack

The system is a classic **decoupled SPA + REST API** build. The frontend is a single-page React application; the backend is a Laravel application exposing a JSON API. They communicate exclusively over HTTP with bearer tokens.

### Backend (Laravel)

| Component | Version (locked) |
|---|---|
| PHP | `^8.3` |
| Laravel Framework | `13.21.1` (composer constraint `^13.8`) |
| Laravel Sanctum | `^4.0` |
| barryvdh/laravel-dompdf | `^3.1` |
| laravel/tinker | `^3.0` |
| PHPUnit | `^12.5.12` |
| laravel/pint (code style) | `^1.27` |

### Frontend (React SPA)

| Component | Version |
|---|---|
| React / react-dom | `^19.2.7` (React 19) |
| react-router-dom | `^7.18.1` |
| Vite | `^8.1.1` |
| TypeScript | `~6.0.2` |
| Tailwind CSS | `^4.3.3` (via `@tailwindcss/vite`) |
| @tanstack/react-query | `^5.101.4` |
| zustand | `^5.0.14` |
| react-hook-form | `^7.82.0` |
| zod | `^4.4.3` |
| recharts | `^3.10.0` |
| lucide-react | `^1.26.0` |
| vitest + @testing-library/react | `^4.1.10` / `^16.3.2` |
| oxlint | `^1.71.0` |

### Database

- **Runtime:** MySQL 8 — database `hotel_management` (per `backend/.env`).
- **Tests:** SQLite in-memory (`:memory:`) via PHPUnit, so the 177-test suite runs without a live MySQL server.

## 2.2 System architecture (request flow)

```
┌───────────────────────────┐
│  React SPA (Vite :5173)    │
│  Guest Portal / Admin UI   │
│  stores token in zustand   │
└──────────────┬────────────┘
               │  fetch('/api/...')
               │  Authorization: Bearer <token>
┌──────────────▼────────────┐
│  Vite dev proxy           │
│  /api  → http://localhost:8000  │
└──────────────┬────────────┘
               │  HTTP
┌──────────────▼────────────┐
│  Laravel API (:8000)       │
│  routes/api.php            │
│  middleware: api → auth:sanctum → role  │
└──────────────┬────────────┘
               │  Eloquent / Query Builder
┌──────────────▼────────────┐
│  MySQL (hotel_management)  │
└───────────────────────────┘
```

Key points about this flow:

- **Development proxy.** The Vite dev server (port `5173`) proxies all `/api/*` requests to Laravel at `http://localhost:8000` with `changeOrigin: true` (`frontend/vite.config.ts`). This removes CORS concerns during development because the browser only ever talks to `localhost:5173`.
- **Stateless authentication.** The backend does not use session cookies for the SPA. Each protected request carries a `Bearer` token issued by Sanctum. The frontend stores the token in a zustand store (persisted in `localStorage`) and attaches it in the request helper.
- **Two request helpers.** Admin uses `frontend/src/lib/api.ts`; the portal uses `frontend/src/lib/portalApi.ts`. They are nearly identical but separated because they read/write different auth stores and surface errors differently (the portal helper parses Laravel validation `errors` to show the first field message, and carries `status`/`retryAfter` for rate-limit handling).
- **Global 401 handling.** `api.ts` dispatches a browser-level `auth:unauthorized` custom event on any 401; `App.tsx` listens for it and routes the user back to `/login`. The portal helper logs the user out and throws "Session expired."
- **React Query for server state.** All data fetching is centralized in hooks (`frontend/src/hooks/useApi.ts` for admin, `usePortalApi.ts` for portal). Mutations invalidate related query keys so lists and the dashboard refresh automatically.

## 2.3 Frontend folder structure

```
frontend/src/
├── App.tsx                 # Router: all admin + portal routes, guards
├── assets/                 # Static assets
├── components/
│   ├── charts/             # RevenueChart.tsx (recharts area chart)
│   ├── layout/             # DashboardLayout, Navbar, Sidebar, Breadcrumb
│   ├── portal/             # PortalLayout, PortalNavbar, PortalFooter
│   ├── shared/             # DataTable, StatCard, PaymentModal,
│   │                       #   ReservationCheckInOutModal, ConfirmDialog,
│   │                       #   ReservationFormModal, ReservationDetailModal,
│   │                       #   ReservationRowActions, RowActions, StatusBadge,
│   │                       #   PageHeader + *.test.tsx
│   └── ui/                 # Reusable primitives: button, input, select, modal,
│                           #   table, card, badge, toast, date-picker,
│                           #   date-range-picker, pagination, skeleton, tooltip,
│                           #   dropdown-menu, guests-picker, ScrollToTop
├── hooks/
│   ├── useApi.ts           # All admin query/mutation hooks (React Query)
│   ├── usePortalApi.ts     # All portal query/mutation hooks
│   ├── useCheckInOutModal.ts
├── lib/
│   ├── api.ts              # Admin fetch wrapper + token + 401 event
│   ├── portalApi.ts        # Portal fetch wrapper (validation errors, 429)
│   ├── permissions.ts      # isAdminRole() helper
│   ├── format.ts           # formatCurrency, formatDateDisplay, etc.
│   └── utils.ts            # cn() class merge helper
├── pages/                  # 21 admin pages (see 2.4)
│   └── portal/             # 10 portal pages (see 2.4)
├── stores/                 # authStore, portalAuthStore, notificationStore, uiStore
├── test/                   # test setup (setup.ts)
└── types/                  # TypeScript domain types (index.ts)
```

### Pages (route map, from `frontend/src/App.tsx`)

**Admin routes** (wrapped in `ProtectedRoute` → `DashboardLayout`):

| Path | Page | Requires admin tier (`RequireRole`)? |
|---|---|---|
| `/login` | LoginPage | public |
| `/dashboard` | DashboardPage | no |
| `/reservations` | ReservationsPage | no |
| `/check-in` | CheckInPage | no |
| `/check-out` | CheckOutPage | no |
| `/guests` | GuestsPage | no |
| `/rooms` | RoomsPage | no |
| `/room-types` | RoomTypesPage | **yes** |
| `/amenities` | AmenitiesPage | **yes** |
| `/room-images` | RoomImagesPage | **yes** |
| `/housekeeping` | HousekeepingPage | no |
| `/maintenance` | MaintenancePage | no |
| `/staff` | StaffPage | **yes** |
| `/invoices` | InvoicesPage | no |
| `/payments` | PaymentsPage | no |
| `/expenses` | ExpensesPage | **yes** |
| `/reports` | ReportsPage | **yes** |
| `/inquiries` | InquiriesPage | **yes** |
| `/settings` | SettingsPage | **yes** |
| `/profile` | ProfilePage | no |

**Guest Portal routes**:

| Path | Page |
|---|---|
| `/portal` | PortalHomePage |
| `/portal/rooms` | PortalRoomsPage |
| `/portal/rooms/:slug` | PortalRoomDetailPage |
| `/portal/book` | PortalBookingPage *(requires portal login)* |
| `/portal/my-reservations` | PortalMyReservationsPage *(requires portal login)* |
| `/portal/profile` | PortalProfilePage *(requires portal login)* |
| `/portal/gallery` | PortalGalleryPage |
| `/portal/contact` | PortalContactPage |
| `/portal/login` | PortalLoginPage |
| `/portal/register` | PortalRegisterPage |

The UI mirrors backend authorization: `RequireRole` uses `isAdminRole(user?.role)` (super_admin / admin / hotel_manager) to gate admin-only pages, and button-level helpers (`isAdminRole`) hide admin-only actions such as deleting a guest or overriding room status. Staff-tier users still *see* the operational pages, matching the backend tier model.

## 2.4 Backend folder structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Controller.php
│   │   │   └── Api/
│   │   │       ├── AuthController.php        # staff login/logout/me/profile/password
│   │   │       ├── ActivityLogController.php
│   │   │       ├── ContactMessageController.php
│   │   │       ├── DashboardController.php
│   │   │       ├── ExpenseController.php
│   │   │       ├── GuestController.php
│   │   │       ├── HousekeepingController.php
│   │   │       ├── InvoiceController.php
│   │   │       ├── MaintenanceController.php
│   │   │       ├── PaymentController.php
│   │   │       ├── ReportController.php
│   │   │       ├── ReservationController.php
│   │   │       ├── RoomController.php
│   │   │       ├── RoomImageController.php
│   │   │       ├── RoomTypeController.php
│   │   │       ├── SearchController.php
│   │   │       ├── SettingController.php
│   │   │       ├── StaffController.php
│   │   │       └── Portal/                   # Guest-side controllers
│   │   │           ├── AuthController.php
│   │   │           ├── ContactController.php
│   │   │           ├── PaymentController.php
│   │   │           ├── ReservationController.php
│   │   │           └── RoomController.php
│   │   ├── Middleware/
│   │   │   └── EnsureUserHasRole.php         # tier-collapsing role guard
│   │   └── Resources/
│   │       ├── RoomResource.php
│   │       ├── RoomTypeResource.php
│   │       ├── AmenityResource.php
│   │       └── RoomImageResource.php
│   ├── Models/                               # 26 Eloquent models
│   ├── Providers/
│   │   └── AppServiceProvider.php            # 'contact' rate limiter
│   └── Services/
│       └── OverdueReservationService.php     # no-show detection
├── bootstrap/app.php                          # middleware alias 'role'
├── config/                                   # auth, sanctum, cors, etc.
├── database/
│   ├── migrations/                           # 43 migrations
│   └── seeders/                              # 13 seeders
├── resources/views/invoices/pdf.blade.php     # PDF invoice template
├── routes/
│   ├── api.php                               # all API routes
│   ├── console.php                           # scheduled task
│   └── web.php                               # GET / (welcome)
└── tests/
    ├── Feature/                              # 10 feature test files, 177 tests
    └── Unit/
```

## 2.5 How the two domains coexist

The key architectural decision is **two separate user tables**:

- `users` — staff/admin accounts only (authenticated with `App\Models\User`).
- `guests` — portal/customer accounts (authenticated with `App\Models\Guest`).

Both models extend `Illuminate\Foundation\Auth\User` (Authenticatable), both use `Laravel\Sanctum\HasApiTokens`, and both have their own Sanctum-issued tokens. This means a single `auth:sanctum` middleware can authenticate either, and the `EnsureUserHasRole` middleware simply checks `$user instanceof Guest` to decide whether the caller is a guest.

The trade-off was deliberate: guests and staff are conceptually different entities with different profiles, so mixing them in one table would force nullable columns and awkward role handling. Splitting them keeps the domain clean (Reservations/Payments/Invoices reference `guest_id` → `guests`, while operational audit columns reference `user_id` → `users`).

---

# Chapter 3. Database Design

## 3.1 Design philosophy

The schema is defined by **43 migrations** in `backend/database/migrations/`. Notable conventions:

- **No native `ENUM` columns.** Statuses are `VARCHAR` columns with values enforced at the application layer (validation rules and controller guards). This keeps migrations portable across MySQL and SQLite (important because the test suite runs on SQLite).
- **UUID where frameworks require it.** `notifications.id` is a UUID (Laravel's default notification shape). Every other primary key is an unsigned big integer.
- **Soft deletes are not used.** Records are deleted or guarded against deletion; destructive actions that would break financial or historical integrity are blocked explicitly (see Chapter 4).
- **Timestamps everywhere** (`created_at`, `updated_at`), plus dedicated audit columns like `paid_at`, `completed_at`, `checked_in_at`, `checked_out_at`, `ordered_at`, `received_at`, `overdue_at`.
- **JSON columns for flexible data.** `room_types.amenities_json`, `activity_logs.old_values/new_values`, `notifications.data`, and the FAQ stored as a JSON blob in `settings`.
- **Composite indexing added for query performance.** A dedicated migration (`2026_07_31_000004_optimize_database_indexes`) adds seven named indexes for the hottest queries (overlap checks, dashboard aggregations, portal room picking, reports).

## 3.2 Table inventory (38 tables)

The tables fall into logical groups.

### 3.2.1 Identity & roles

**`users`** — staff/admin accounts.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar(255) | |
| email | varchar(255) | unique |
| password | varchar(255) | bcrypt-hashed |
| email_verified_at | timestamp, nullable | |
| remember_token | varchar(100), nullable | |
| phone | varchar(255), nullable | added via migration 000029 |
| avatar | varchar(255), nullable | |
| role_id | bigint FK → roles.id | `nullOnDelete`; canonical role |
| is_active | boolean, default true | deactivated accounts blocked at login/middleware |
| role | varchar(255) default 'staff' | legacy string column, kept but **not** the canonical source |
| timestamps | | |

**`roles`** — `id`, `name` (unique), `slug` (unique), `description`, timestamps. Seeded: `super_admin`, `admin`, `hotel_manager`, `receptionist`, `housekeeping`, `cashier`, `staff`.

**`permissions`** — `id`, `name` (unique), `slug` (unique), `module`, timestamps. Seeded as 12 modules × 4 actions (`view/create/edit/delete`) = 48 permissions.

**`role_permission`** — composite PK (`role_id`, `permission_id`); both FKs cascade on delete. Many-to-many between roles and permissions.

**`guests`** — portal/customer accounts. This table went through a refactor (migrations 000029–000032) where portal credentials (`password`, `remember_token`, `email_verified_at`) were moved *into* the `guests` table so guests authenticate directly via the `Guest` model.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| first_name / last_name | varchar(255) | |
| email | varchar(255) | unique |
| phone | varchar(255) | |
| password | varchar(255), nullable | added 000031; guests created by front desk get a random password |
| remember_token | varchar(100), nullable | |
| email_verified_at | timestamp, nullable | |
| nationality | varchar(255), nullable | |
| date_of_birth | date, nullable | |
| gender | varchar(255), nullable | |
| address / city / country / postal_code | text / varchar(255) | |
| photo | varchar(255), nullable | |
| is_vip | boolean default false | |
| is_blacklisted | boolean default false | blacklisted guests blocked from portal login |
| notes | text, nullable | |
| timestamps | | |

**`password_reset_tokens`**, **`sessions`** — Laravel framework tables. Note: although `password_reset_tokens` exists, **no password-reset feature is implemented** (see Chapter 8).

### 3.2.2 Framework / infrastructure tables

**`cache`**, **`cache_locks`**, **`jobs`**, **`job_batches`**, **`failed_jobs`**, **`personal_access_tokens`** (Sanctum), **`notifications`** (UUID PK, `notifiable_type/id` polymorphic).

### 3.2.3 Properties: room types, rooms, amenities

**`room_types`** — the sellable categories.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar(255) | |
| slug | varchar(255) | unique; used in portal URL `/portal/rooms/{slug}` |
| description | text, nullable | |
| base_price | decimal(10,2) | source of portal pricing |
| capacity | int default 2 | |
| size_sqm | decimal(8,2), nullable | |
| bed_type | varchar(255), nullable | |
| max_adults | int default 2 | |
| max_children | int default 0 | |
| amenities_json | json, nullable | denormalized feature list |
| is_active | boolean default true | |
| sort_order | int default 0 | controls portal ordering |
| timestamps | | |

Seeded room types: Standard Room (₱150/night), Deluxe Room (₱250), Junior Suite (₱350), Executive Suite (₱500), Penthouse (₱1,200), Family Room (₱200).

**`rooms`** — physical rooms.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| room_number | varchar(255) | unique (e.g. "101") |
| room_type_id | bigint FK → room_types | cascade delete |
| floor | int | |
| status | varchar(255) default 'available' | available / occupied / reserved / dirty / maintenance |
| cleaning_status | varchar(255) default 'clean' | clean / dirty / in_progress |
| price_override | decimal(10,2), nullable | |
| capacity | int | |
| description / notes | text, nullable | |
| is_active | boolean default true | |
| timestamps | | |

Indexes: `status`, `cleaning_status`, `floor`, plus composite `idx_rooms_type_status_active_order` (room_type_id, status, is_active, floor, room_number).

Seeded: 30 rooms across 3 floors (rooms 101–110, 201–210, 301–310).

**`amenities`** — `id`, `name`, `icon`, `description`, `is_active`, timestamps.

**`room_amenity`** — pivot table, composite PK (`room_id`, `amenity_id`), both cascade.

**`room_images`** — `id`, `room_id` FK (cascade), `image_path`, `caption`, `sort_order`, `is_primary`, timestamps. The portal picks `is_primary` image first, falling back to the first image.

### 3.2.4 Transactions: reservations, payments, invoices

**`reservations`** — the core business entity.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | used for numbering (see below) |
| reservation_number | varchar(255) | unique; `BK-{year}-{seq}` |
| guest_id | bigint FK → guests | cascade |
| room_id | bigint FK → rooms | cascade |
| status | varchar(255) default 'pending' | pending / confirmed / checked_in / checked_out / cancelled / no_show |
| check_in / check_out | date | |
| adults / children | int default 1 / 0 | |
| price_per_night | decimal(10,2) | |
| total_nights | int | |
| subtotal | decimal(10,2) | |
| discount_percent / discount_amount | decimal(5,2) / decimal(10,2) | |
| tax_percent / tax_amount | decimal(5,2) / decimal(10,2) | tax rate from settings |
| total_amount | decimal(10,2) | |
| paid_amount | decimal(10,2) default 0 | sum of *completed* payments |
| due_amount | decimal(10,2) default 0 | `max(0, total − paid)` |
| payment_status | varchar(255) default 'unpaid' | unpaid / partial / paid |
| special_requests / notes | text, nullable | |
| source | varchar(255), nullable | e.g. `booking_engine`, walk-in sources |
| confirmed_by / checked_in_by / checked_out_by / created_by | bigint FK → users | `set null` on user delete |
| checked_in_at / checked_out_at | timestamp, nullable | |
| is_overdue | boolean default false | no-show risk flag |
| overdue_at | timestamp, nullable | |
| no_show_by | bigint, nullable | *not a declared FK* (see 3.3) |
| timestamps | | |

Indexes: `status`, `payment_status`, `check_in`, `check_out`, `source`, plus `idx_res_room_status_dates` (room_id, status, check_in, check_out), `idx_res_guest_created` (guest_id, created_at), `idx_res_created_at`.

**`payments`** — money received on a reservation.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| reservation_id | bigint FK → reservations | cascade |
| guest_id | bigint FK → guests | cascade |
| amount | decimal(10,2) | |
| payment_method | varchar(255) | cash / gcash |
| payment_type | varchar(255) | full / partial / deposit / refund (staff); portal: full/partial/deposit |
| status | varchar(255) default 'completed' | pending / completed / failed / refunded |
| transaction_id | varchar(255), nullable | |
| reference_number | varchar(255), nullable | unique |
| notes | text, nullable | |
| processed_by | bigint FK → users, nullable | `set null` |
| paid_at | timestamp, nullable | |
| timestamps | | |

Indexes: `status`, `payment_method`, `payment_type`, plus composite `idx_payments_status_created_at` (status, created_at).

**`invoices`** — billing documents.

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| invoice_number | varchar(255) | unique; `INV-{year}-{seq}` |
| reservation_id / guest_id | FKs (cascade) | |
| amount / tax_amount / discount_amount | decimal(10,2) | |
| total_amount | decimal(10,2) | `amount + tax − discount` |
| paid_amount / due_amount | decimal(10,2) default 0 | |
| status | varchar(255) default 'draft' | draft / sent / paid / cancelled |
| issued_date / due_date | date | due defaults to +30 days |
| notes | text, nullable | |
| created_by | FK → users, nullable | |
| timestamps | | |

Indexes: `status`, `issued_date`, `due_date`, plus `idx_invoices_created_at`.

**`invoice_items`** — line items. `id`, `invoice_id` FK (cascade), `description`, `quantity`, `unit_price`, `total_price`, `type`, timestamps.

### 3.2.5 Operations: housekeeping, maintenance, expenses

**`housekeeping_tasks`** — `id`, `room_id` FK (cascade), `assigned_to` FK → users (nullable, set null), `status` (pending / in_progress / completed / etc.), `priority` (normal / etc.), `task_type`, `notes`, `scheduled_date`, `completed_at`, `inspected_by` FK (nullable), `created_by` FK (nullable), timestamps. Indexes on `status`, `priority`, `task_type`, `scheduled_date`.

**`maintenance_requests`** — `id`, `room_id` FK (cascade), `reported_by` FK → users (cascade), `assigned_to` FK (nullable), `title`, `description`, `category`, `priority`, `status` (reported / in_progress / completed / etc.), `estimated_cost` / `actual_cost`, `completed_at`, `notes`, timestamps. Indexes on `category`, `priority`, `status`.

**`maintenance_images`** — `id`, `maintenance_request_id` FK (cascade), `image_path`, `caption`, timestamps.

**`expenses`** — `id`, `category`, `amount`, `description`, `date`, `receipt`, `approved_by` FK (nullable), `created_by` FK (nullable), timestamps. Indexes on `category`, `date`.

### 3.2.6 Inventory & purchasing (seeded structure, no API surface yet)

**`inventory_categories`** (unique name), **`suppliers`**, **`inventory_items`** (FK category, SKU unique, unit, quantity/min_quantity/price_per_unit, supplier_id, expiration_date), **`purchase_orders`** (FK supplier, unique order_number, status, total_amount, ordered_by/received_by FKs, ordered_at/received_at), **`purchase_order_items`** (FK purchase_order + inventory_item, quantity, unit_price, total_price, received_quantity).

> **Important:** Models exist and migrations are complete, but there are **no controllers, routes, or pages** for inventory/purchasing. This is forward scaffolding (see Chapter 8).

### 3.2.7 Staff administration

**`staff_schedules`** — `id`, `user_id` FK (cascade), `date`, `start_time`, `end_time`, `department`, `notes`, timestamps. Indexes on `date`, `department`.

**`leave_requests`** — `id`, `user_id` FK (cascade), `start_date`, `end_date`, `type`, `status` (pending/approved/declined), `reason`, `approved_by` FK (nullable), timestamps. Indexes on `status`, `type`, `start_date`.

**`user_activity_log`** — a lightweight per-user log: `user_id` FK (cascade), `action`, `ip_address`, `user_agent`, timestamps. (Distinct from the richer `activity_logs` table.)

### 3.2.8 System & audit

**`activity_logs`** — the global audit trail. `id`, `user_id` FK (nullable, set null — portal actions log `null`), `action` (e.g. `created`, `checked_in`, `cancelled`, `flagged_overdue`), `module` (e.g. `reservations`, `payments`, `guests`, `auth`), `model_type`/`model_id` (polymorphic), `description`, `old_values`/`new_values` (JSON), `ip_address`, `user_agent`, timestamps. Indexes: (model_type, model_id), `action`, `module`, `user_id`, plus `idx_activity_logs_created_at`.

**`settings`** — key/value store. `id`, `key` (unique), `value` (text, nullable), `group`, timestamps. Index on `group`. Groups: `hotel`, `tax`, `booking`, `contact`, `security`, `general` (see Appendix B).

**`contact_messages`** — portal contact-form submissions. `id`, `name`, `email`, `subject`, `message`, `ip_address` (varchar 45), timestamps. Index on `created_at`.

**`personal_access_tokens`** — Sanctum tokens. `id`, `tokenable_type/id` (polymorphic — works for both User and Guest), `name` (`api-token` for staff, `portal-token` for guests), `token` (hashed), `abilities`, `last_used_at`, `expires_at`, timestamps.

## 3.3 Relationships

The Eloquent models (`app/Models/`) declare these relationships:

```
User (staff)
 ├── role()                     BelongsTo → Role
 ├── reservationsCreated()      HasMany → Reservation (created_by)
 ├── tasksAssigned()            HasMany → HousekeepingTask (assigned_to)
 ├── schedules()                HasMany → StaffSchedule
 ├── leaveRequests()            HasMany → LeaveRequest
 └── activityLogs()             HasMany → ActivityLog

Role
 └── permissions()              BelongsToMany → Permission (via role_permission)

Guest (portal customer)
 ├── reservations()             HasMany → Reservation
 ├── payments()                 HasMany → Payment
 └── invoices()                 HasMany → Invoice

RoomType
 └── rooms()                    HasMany → Room

Room
 ├── roomType()                 BelongsTo → RoomType
 ├── reservations()             HasMany → Reservation
 ├── housekeepingTasks()        HasMany → HousekeepingTask
 ├── maintenanceRequests()      HasMany → MaintenanceRequest
 ├── amenities()                BelongsToMany → Amenity (via room_amenity)
 └── images()                   HasMany → RoomImage (ordered by sort_order)

Reservation
 ├── guest()                    BelongsTo → Guest
 ├── room()                     BelongsTo → Room
 ├── payments()                 HasMany → Payment
 ├── invoices()                 HasMany → Invoice
 ├── confirmedBy()              BelongsTo → User (confirmed_by)
 ├── checkedInBy()              BelongsTo → User (checked_in_by)
 ├── checkedOutBy()             BelongsTo → User (checked_out_by)
 └── createdBy()                BelongsTo → User (created_by)

Payment
 ├── reservation()              BelongsTo → Reservation
 ├── guest()                    BelongsTo → Guest
 └── processedBy()              BelongsTo → User (processed_by)

Invoice
 ├── reservation()              BelongsTo → Reservation
 ├── guest()                    BelongsTo → Guest
 ├── items()                    HasMany → InvoiceItem
 └── createdBy()                BelongsTo → User (created_by)

MaintenanceRequest
 ├── room()                      BelongsTo → Room
 ├── reportedBy()                BelongsTo → User (reported_by)
 ├── assignedTo()                BelongsTo → Technician (assigned_to)
 └── images()                    HasMany → MaintenanceImage

Technician (maintenance staff, no login)
 └── maintenanceRequests()       HasMany → MaintenanceRequest (assigned_to)

HousekeepingTask / Expense / StaffSchedule /
LeaveRequest / PurchaseOrder / ActivityLog  → BelongsTo User (various FK columns)
```

**ER notes for diagramming:**

- `users` is related to `roles` via `role_id` (many-to-one). The legacy `role` string column is **not** used as the canonical role.
- `reservations` is the central hub: it links a `guest`, a `room`, and (through payments/invoices) money.
- `reservations.no_show_by` has **no declared foreign key** (an oversight; it stores a `users.id` value but the constraint was not added).
- Audit columns (`confirmed_by`, `checked_in_by`, etc.) all point to `users`, never to `guests` — because only staff perform those actions.
- `activity_logs` and `personal_access_tokens` are polymorphic (`model_type`/`tokenable_type`), so they can reference either staff or guest entities.

## 3.4 Composite indexes (performance migration)

`2026_07_31_000004_optimize_database_indexes` adds seven indexes to serve the hottest queries:

| Index | Columns | Serves |
|---|---|---|
| `idx_res_room_status_dates` | reservations (room_id, status, check_in, check_out) | double-booking overlap check + room-status reconciliation |
| `idx_res_guest_created` | reservations (guest_id, created_at) | portal "my reservations" listing |
| `idx_res_created_at` | reservations (created_at) | report date-range queries + year-max numbering |
| `idx_payments_status_created_at` | payments (status, created_at) | dashboard/report revenue aggregations |
| `idx_rooms_type_status_active_order` | rooms (room_type_id, status, is_active, floor, room_number) | portal room pick by type (covering index, avoids sort) |
| `idx_activity_logs_created_at` | activity_logs (created_at) | recent-activity feed |
| `idx_invoices_created_at` | invoices (created_at) | invoice year-max numbering |

All index creation is guarded with `Schema::hasIndex` so the migration is idempotent on fresh and existing databases.

---

# Chapter 4. Core Features & Business Logic

This chapter documents each functional area with the exact rules enforced by the controllers.

## 4.1 Authentication & accounts

### Staff (admin) login — `POST /api/login` (`AuthController@login`)

1. Validates `email` (required, email) and `password` (required).
2. Looks up the user by email. If the user is missing **or** the password does not hash-match, returns a **generic** validation error: *"The provided credentials are incorrect."* — deliberately identical for both failure cases to prevent account enumeration.
3. If `is_active === false`, returns **403** *"Your account is deactivated. Contact an administrator."* (deactivated staff cannot log in).
4. Issues a Sanctum token named `api-token` and returns `{ token, user }` with the role loaded.
5. The route is rate-limited to **6 attempts/minute per IP** (`throttle:6,1`).

### Staff profile & password

- `GET /api/me` — current user with role.
- `PUT /api/profile` — update name/email/phone/avatar (email uniqueness scoped to self).
- `PUT /api/password` — requires `current_password`, new password `min:8|confirmed`; wrong current password returns *"The current password is incorrect."*.
- `POST /api/logout` — deletes the **current** Sanctum token (server-side revocation, not just a client-side store clear).

### Guest registration — `POST /api/portal/register` (`Portal\AuthController@register`)

1. Validates first/last name, email (`unique:guests,email`), phone, password (`min:8|confirmed`), optional gender.
2. Creates a single `guests` record (password bcrypt-hashed) inside a DB transaction.
3. Issues a Sanctum token named `portal-token`; returns 201 with token + user.
4. Rate-limited `throttle:6,1`.

### Guest login — `POST /api/portal/login`

Same generic-credentials pattern. **Blacklisted guests are blocked**: `is_blacklisted` → 403 *"Account has been deactivated. Please contact support."*

### Guest profile / password / account deletion

- `PUT /api/portal/profile` — updates profile fields; empty strings are normalized to `null` for optional fields.
- `PUT /api/portal/password` — requires current password, `min:8|confirmed`; logs an activity entry.
- `DELETE /api/portal/profile` (`destroyAccount`) — **blocked with 422** if the guest has any reservation history: *"Cannot delete account with reservation history. Please contact support."* This prevents cascading deletion of financial records. When allowed, revokes all tokens, then deletes.

## 4.2 Room catalog & availability (portal)

The portal exposes three public endpoints (no auth):

- **`GET /api/portal/rooms`** — list active room types. If `check_in`/`check_out` query params are provided, only types that still have at least one available, non-overlapping room are returned. Each type carries a `rooms_count` (available rooms) and an `image_url` (the primary image of the first available room of that type).
- **`GET /api/portal/rooms/{slug}`** — detail of one active room type by slug, with available rooms and images.
- **`GET /api/portal/rooms/available`** — requires `check_in`, `check_out` (validated `after:check_in`), optional `room_type_id`; returns the physical rooms that are available and not overlapping any active reservation.

**Availability math.** A room is "occupied" for a date range if it overlaps any *active* reservation, where active = status not in `['cancelled', 'checked_out', 'no_show']`. Overlap is computed with the **half-open interval** `[check_in, check_out)`:

```sql
WHERE check_in < :new_check_out
  AND check_out > :new_check_in
```

Three equivalent formulations appear in the code for readability: `whereBetween` on check_in and check_out plus a "contains" clause. The composite index `idx_res_room_status_dates` makes this query fast.

## 4.3 Booking

### Portal booking — `POST /api/portal/reservations` (`Portal\ReservationController@store`)

The portal books **by room type**, not by a specific room:

1. Validates `room_type_id`, `check_in`, `check_out` (after check_in), `adults` (≥1), `children`, optional `special_requests`.
2. Reads `max_advance_days` from settings (default 30; `0` = unlimited). If check-in is beyond `today + max_advance_days`, rejects with *"Bookings can be made up to {N} days in advance."*
3. Computes pricing from `room_type.base_price`:
   - `nights = diffInDays(check_in, check_out)` — clamped to a **minimum of 1** so same-day ranges never produce a zero or negative total.
   - `subtotal = base_price × nights`
   - `tax = subtotal × tax_rate` (tax_rate from settings, default 10%)
   - `total = round(subtotal + tax, 2)`
4. Inside a DB transaction:
   - Finds all room IDs overlapping the requested range (active reservations only).
   - Picks the **first available active room of that type** (`status = available`, `is_active = true`, not overlapping, ordered by floor then room number). If none: 422 *"No rooms of this type are available for the selected dates."*
   - Generates `reservation_number = BK-{year}-{next seq}` where seq = `max(id)` of this year's reservations + 1, zero-padded to 4 digits.
   - Creates the reservation with `status = confirmed`, `payment_status = unpaid`, `due_amount = total`, `source = booking_engine`, `created_by` = null (guest-created).
   - Marks the room `reserved`.
5. Writes an `activity_logs` entry (with `user_id = null`, describing the guest).

> Doing the room assignment *inside* the transaction with the overlap check prevents two concurrent bookings from grabbing the same room.

### Front-desk booking — `POST /api/reservations` (`ReservationController@store`)

The staff flow books a **specific room**:

1. Validates guest details (name, phone, optional email), `room_id` (exists), dates, occupants, optional `source`/`special_requests`, `price_per_night`, optional discount percent.
2. **Guest auto-create/reuse:** if a guest with the provided email exists, reuse it; otherwise create a new guest record (front-desk guests get a random 12-char password so they can still log into the portal later).
3. Computes pricing: `nights` (not clamped to 1 here), `subtotal = rate × nights`, `discount = subtotal × discount_percent%`, `tax = (subtotal − discount) × tax_rate`, `total = round(...)`.
4. Runs the overlap check via `roomHasOverlap()`. If the room is already booked for those dates: 422 *"The selected room is not available for the selected dates."*
5. Marks the room `reserved` and creates the reservation as `confirmed` (with `created_by` = the staff member).

## 4.4 Reservation lifecycle & status transitions

### Statuses

`pending` → `confirmed` → `checked_in` → `checked_out`; branches to `cancelled` (from pending/confirmed) and `no_show` (from confirmed).

### Enforced transitions

`ReservationController@update` defines an allowed-transition map:

| From | Allowed to |
|---|---|
| `pending` | confirmed, checked_in, cancelled |
| `confirmed` | checked_in, cancelled, no_show |
| `checked_in` | checked_out |
| `checked_out` | *(none — terminal)* |
| `cancelled` | *(none — terminal)* |
| `no_show` | *(none — terminal)* |

The guard is enforced only when the new status is `cancelled` or `no_show`; other in-place status changes are permitted by `update()` (a known gap — see Chapter 8). Changing to a disallowed terminal state returns 422 *"Cannot change status from {old} to {new}."*

### Dedicated action endpoints (all require `auth:sanctum` + staff tier)

- **`POST /reservations/{id}/check-in`** — only from `confirmed` or `pending` (else 422 *"Only confirmed or pending reservations can be checked in."*). **Payment guard:** if `due_amount > 0` and no payment record exists, block with 422 *"Collect a payment before checking in."* On success: status → `checked_in`, records `checked_in_by` + `checked_in_at`, room → `occupied`.
- **`POST /reservations/{id}/check-out`** — only from `checked_in` (else 422). **Payment guard (full settlement):** if `due_amount > 0`, block with 422 *"Settle the outstanding balance before checking out."* Pending GCash and partial payments both count as outstanding. On success: status → `checked_out`, room → `dirty` + cleaning `dirty`.
- **`POST /reservations/{id}/cancel`** — blocked for `checked_in`/`checked_out`/`cancelled`; reconciles the room status.
- **`POST /reservations/{id}/no-show`** — only from `confirmed`; sets `no_show_by` and clears `is_overdue`; reconciles the room.
- **`POST /reservations/refresh-overdue`** — manually runs the overdue detector (admin tier).

### Room status lifecycle

Room statuses: `available`, `reserved`, `occupied`, `dirty`, `maintenance`. The system derives room status from reservations:

- Booking/update → `reserved`.
- Check-in → `occupied`.
- Check-out → `dirty` (+ cleaning `dirty`).
- Cancel / no-show / delete → `reconcileRoomStatus()`:
  - If the room still has any active reservation → `reserved` (or `occupied` if one is checked in).
  - Otherwise → `available`.

This reconciliation is what prevents a room from being stuck as "reserved" after a cancellation, and it is why the front desk's *portal* cancel sets the room `available` directly while the *admin* cancel reconciles properly.

### Overdue / no-show detection

`App\Services\OverdueReservationService::detectAndFlagOverdue()`:

1. Finds `confirmed` reservations whose `check_in < today` and not yet flagged `is_overdue`.
2. Sets `is_overdue = true` and `overdue_at = check_in start-of-day`.
3. Writes an activity-log entry ("Overdue reservation #... flagged for No Show review").
4. Notifies admin/hotel_manager users by writing `notified_overdue` activity entries for each.

It runs **hourly** via the scheduler (`routes/console.php`: `Schedule::command('reservations:detect-overdue')->hourly()`) and can also be triggered on demand through the admin "refresh overdue" button.

### Admin update / delete rules

- `update()` re-checks overlap **when the room changes or when dates change** (the room must be free for the *new* room + *new* dates, excluding the reservation being edited). When pricing inputs change, it recomputes nights/subtotal/discount/tax/total/due. If the room changes, the old room's status is reconciled.
- `destroy()` **refuses** to delete `checked_in` or `checked_out` reservations (422), then deletes in a transaction and reconciles the room.

## 4.5 Payments

### Recording a payment — `POST /api/payments` (staff)

Validation: `reservation_id` (exists), `amount` (≥0), `payment_method` in `cash|gcash`, `payment_type` in `full|partial|deposit|refund`, optional status (default `completed`) and reference.

In a transaction:

1. Attaches the reservation's `guest_id` and sets `paid_at = now()`.
2. Creates the payment.
3. **Recomputes the reservation's payment summary from completed payments only:**
   - `paid_amount = SUM(amount) WHERE status = completed`
   - `payment_status = paid if paid_amount >= total_amount else partial`
   - `due_amount = max(0, total_amount - paid_amount)`

`update()` (payment status/method/reference/notes) **also recomputes** the reservation summary whenever the payment `status` changes — so marking a pending GCash payment as `completed` or un-completing a payment keeps the ledger correct.

`destroy()` is **disabled**: *"Payments cannot be deleted. Use refund instead."* (422). A refund is modeled as a new payment with `payment_type = refund`.

### Portal payment — `POST /api/portal/payments`

More restrictive than staff:

- `payment_type` limited to `full|partial|deposit` (**no refund** — guests can't self-refund).
- The payment must belong to the calling guest (422 *"This reservation does not belong to you."*).
- Rejected for `cancelled`/`checked_out`/`no_show` reservations (422 *"This reservation can no longer be paid."*).
- Rejected when already fully paid (422 *"This reservation is already fully paid."*).
- Payments are always recorded `completed` (portal GCash note is a UI convention; the front desk flow uses `pending` for GCash).

### The front-desk payment flow (check-in/check-out)

A shared `PaymentModal` component (cash + GCash tabs) powers payment collection from both the Payments page and the one-step check-in/check-out modal:

- **Cash tab:** amount (Full/Half quick buttons), cash tendered, and computes **change due** / **guest still owes**.
- **GCash tab:** amount + reference, recorded as **`pending`** with a note to verify on the Payments page.
- **Full/Half quick buttons** set the amount to the full due or half of it.

The `ReservationCheckInOutModal` makes payment an explicit part of the front-desk workflow:

- `requiresPayment` is mode-aware:
  - **check-in:** needs at least one payment recorded (`hasBalance && !hasPayment`).
  - **check-out:** needs full settlement (any `hasBalance` — matching the backend full-settlement rule).
- When required, the primary button becomes **"Collect & Check In/Out"**, which opens the `PaymentModal`; on a successful payment the status change runs automatically (no second click).
- A **ghost "Collect ₱X"** button appears for check-in when a payment exists but a balance remains (optional top-up), and for check-out during a retry when a balance remains so a blocked partial/pending payment isn't a dead-end.
- **Retry safety (`paymentRecorded`):** if the status change fails *after* a payment was recorded, the error banner explains that the amount was already collected, and retry only re-runs the status change — it never re-creates a payment. The local reservation state is patched with the recorded amount before the retry.

This flow is covered by frontend tests (`ReservationCheckInOutModal.test.tsx`, `PaymentModal.test.tsx`) and backend guard tests (`ReservationsPageTest`).

## 4.6 Invoicing & PDF

- `POST /api/invoices` — builds an invoice from a reservation + line items (`description`, `quantity`, `unit_price`); totals: `total = amount + tax − discount`; defaults: `issued_date = today`, `due_date = +30 days`, `status = draft`; number `INV-{year}-{seq}` (same max-id-per-year scheme as reservations).
- `PUT /api/invoices/{invoice}` — replaces line items when `items` sent; recomputes totals; and **whenever `status` changes, recomputes the reservation's payment summary from the sum of `invoices.total_amount` where status = paid** (this is why un-marking a paid invoice reverts the reservation's paid amount).
- `DELETE /api/invoices/{invoice}` — only `draft` invoices can be deleted.
- `GET /api/invoices/{invoice}/pdf` — renders `resources/views/invoices/pdf.blade.php` through barryvdh/laravel-dompdf. The template reads the hotel name/address/phone/email from `hotel_*` settings (falls back to "Pampanga Home Suites"), uses **DejaVu Sans** so the ₱ peso sign renders correctly, and shows a status-colored badge plus line items and totals.
- Frontend `useDownloadInvoicePdf` triggers a real file download (creates a Blob URL, clicks a temp anchor). A toast surfaces download failures.

## 4.7 Housekeeping

Controllers enforce CRUD minus delete, plus assignment and status updates (`PUT /housekeeping/{task}/status`, `POST /housekeeping/{task}/assign`). Only admin can delete a task. Tasks are room-scoped with priority, type, scheduled date, and completion tracking. Completing a task can drive the room's cleaning state.

## 4.8 Maintenance

Staff can list/create/view requests; admin can update, delete, assign (`POST /maintenance/{request}/assign`), and change status (`PUT .../status`). Requests track reported/assigned users, priority, category, estimated/actual cost, photos (`maintenance_images`), and completion.

## 4.9 Guests (admin side)

- Index with search (name/email/phone) and a live **active-reservations count** (pending/confirmed/checked_in).
- Create/edit with validation; VIP and blacklist flags.
- Front-desk-created guests get a generated random password returned once in the response (`generated_password`) so staff can hand it to the guest.
- `DELETE /guests/{id}` is **blocked** (422) if the guest has any reservation history — same integrity rule as portal account deletion.
- `GET /guests/{id}/history` returns the guest's stay history (paginated, with room type).

## 4.10 Staff, schedules & leave (admin)

`StaffController` manages users: list, create, update, roles, leave requests, and schedules — all admin-tier. Staff creation respects tier limits (an admin/manager cannot create an account above their own tier). `GET /staff/assignable` returns active staff id+name for dropdowns and is available to the operational tier (so housekeeping/maintenance assignment doesn't require admin API access).

## 4.11 Dashboard & reporting

**Dashboard (`DashboardController`)** — staff tier:

- `stats`: today's revenue (sum of completed payments today), occupancy rate (`occupied / total rooms`), available/booked rooms, check-ins/check-outs today (excluding cancelled/no_show only — a same-day check-in that also checks out still counts), pending reservations, total rooms.
- `revenue`: 30-day revenue (completed payments) and bookings series, back-filled with zeros for days with no data.
- `occupancy`: 30-day occupancy rate computed from overlapping reservations in one query, then daily rates derived in PHP (avoids N queries per day).
- `bookingSources`: counts of reservations grouped by `source`.
- `recentActivities`: the 10 latest activity-log entries with user.
- `topRoomTypes`: current-month reservation counts per room type.

**Reports (`ReportController`)** — admin tier:

- `revenue` (from/to, group by day/week/month) from completed payments.
- `occupancy` (from/to) — per-day occupied/available/rate.
- `reservations` (from/to) — total, status breakdown, daily counts.
- `export/{type}` — CSV export for `revenue|occupancy|reservations` (whitelist-validated type to prevent path injection), streamed in chunks and deleted after send.

## 4.12 Settings & branding

`SettingController`:

- `GET /settings` and `PUT /settings` (admin) — update any key/value; `groupForKey()` routes each key into the right group (so the Contact tab can save `hotel_address` into the `hotel` group by key).
- `GET /settings/{group}` — public in the portal (`/portal/settings/{group}`) so the portal can read `hotel`/`contact`/`booking` config without auth.
- **Logo upload** (`POST /settings/logo`, admin): stores under `public` disk `branding/`, deletes the old file, saves the path into the `hotel_logo` setting; the value is decorated into a full `/storage/...` URL in responses. `DELETE /settings/logo` removes it. (Requires `php artisan storage:link`.)
- Tax rate and max advance days are read from settings in the reservation controllers (single source of truth).

Portal branding reads `hotel_*` settings via `useHotelSettings()` (footer, contact page, navbar logo fallback, invoice PDF header).

## 4.13 Contact form & inquiries

`POST /api/portal/contact` (public, rate-limited to **3/hour per IP** via the `contact` limiter in `AppServiceProvider`):

- Validates name/email/subject/message, plus a hidden **honeypot** `website` field. If `website` is filled (bot), returns 201 "success" but silently drops the message.
- Stores the message in `contact_messages` with the sender's IP.
- Admin-only `GET/DELETE /api/contact-messages` + `GET /{id}` feed the **Inquiries** page: list, detail modal (Reply opens a prefilled Gmail compose draft), and delete.

## 4.14 Search

`GET /api/search?q=` (staff) returns unified results across guests, reservations, rooms, and room types, with a per-result type, title, subtitle, badge, and frontend route for navigation.

## 4.15 Activity logging

Every mutating action across reservations, payments, guests, invoices, housekeeping, maintenance, expenses, auth, and settings writes an `activity_logs` row with action, module, model type/id, description, and (for staff actions) user. Portal-generated actions log `user_id = null` but include a human-readable description (e.g. "Guest Jane Doe cancelled reservation #..."). The dashboard shows the 10 most recent; an admin-only Activity Logs page lists all with filtering.

---

# Chapter 5. Security

## 5.1 Authentication

- **Password hashing.** All passwords use `Hash::make` (bcrypt). `BCRYPT_ROUNDS=12` is set in `.env.example`, and the `password` attribute on both `User` and `Guest` is cast via Laravel's `'hashed'` cast, so assignment auto-hashes.
- **Token authentication.** Laravel Sanctum issues personal access tokens (`personal_access_tokens` table). Staff tokens are named `api-token`, guest tokens `portal-token`. Tokens are **revocable**: logout deletes the current token server-side. Guests' account deletion also revokes all tokens.
- **Token expiry.** `config/sanctum.php` sets `'expiration' => env('SANCTUM_TOKEN_EXPIRATION', 60 * 24)` — tokens expire after **24 hours** by default (overridable via env). Expired tokens fail authentication, forcing a re-login.
- **Generic credential errors.** Both login endpoints return the identical message *"The provided credentials are incorrect."* for a bad email or a bad password, preventing user-enumeration via the response.
- **Account-disable enforcement.** `AuthController@login` returns 403 for `is_active = false` staff; `EnsureUserHasRole` also blocks deactivated staff on *every* request. Blacklisted guests are blocked at portal login.

## 5.2 Authorization (role tiers)

`EnsureUserHasRole` middleware (aliased as `role` in `bootstrap/app.php`) is the authorization gate:

1. No user → 401 "Unauthenticated."
2. `Guest` instance → role `guest`.
3. Staff: if `is_active === false` → 403.
4. Maps role slugs to a tier:
   - `super_admin` / `admin` / `hotel_manager` → **`admin`**
   - `receptionist` / `housekeeping` / `cashier` / `staff` → **`staff`**
5. If the route requires a role not matched → 403 "Forbidden."

Routes therefore specify either `role:admin,staff` (operational) or `role:admin` (administrative). This is a deliberately coarse but robust model: it's simple to reason about, and it automatically collapses the seven roles into two tiers, so e.g. a hotel manager gets full admin capability without extra config.

**Admin-only routes** include: Staff, Expenses, Reports, Settings, Activity Logs, Room Images, Room Types, Rooms create/update/delete/status-override, Guest delete, Housekeeping delete, Maintenance update/destroy/assign/status.

**Operational (all staff) routes** include: Guests CRUD minus delete + history, Housekeeping CRUD minus delete + assign/status, Maintenance index/store/show, Rooms read + `PUT /rooms/{room}/status`, Invoices, Payments, Reservations (full lifecycle), Dashboard, Search.

The frontend mirrors this with `isAdminRole()` in `src/lib/permissions.ts` for page guards and button-level gating.

## 5.3 Rate limiting

- Staff login, portal login, portal register: `throttle:6,1` (6 attempts per minute).
- Contact form: named limiter `contact` → **3 requests/hour per IP** (defined in `AppServiceProvider::boot`). A friendly 429 message is surfaced in the portal (the portal API helper reads `Retry-After`).

## 5.4 Input validation & injection defense

- **Every** controller validates request input via Laravel's `$request->validate()` with `in:` whitelists for enum-like fields (room status, payment method, invoice status, etc.), `min/max`, `exists:` FK checks, and `after:` date ordering. Invalid input returns 422 with field errors.
- **SQL injection** is mitigated by Eloquent/Query-Builder parameterization throughout. Search filters use `where('col', 'like', "%{$q}%")` with bound parameters, never string interpolation.
- **Sort-field whitelisting** in `PaymentController` and a **report-type whitelist** in `ReportController::export` (`in_array($type, ['revenue','occupancy','reservations'])`) prevent injection and path traversal in CSV export.
- **Ownership checks** in portal controllers (reservation/payment must belong to the calling guest) prevent cross-account access; `show`/`cancel` return 404 for others' records.

## 5.5 XSS & output encoding

- The SPA renders data through React, which escapes text by default. Statuses/badges are mapped to components rather than raw HTML.
- The PDF invoice Blade template uses standard `{{ }}` escaping for guest and hotel data.
- `Content-Type: application/json` is set for API responses; the Laravel API error handler renders JSON for all `/api/*` requests (`bootstrap/app.php` → `shouldRenderJsonWhen`).

## 5.6 CSRF / CORS

- The SPA authenticates with bearer tokens (not cookies), so classic CSRF is largely out of scope for the API. Sanctum's stateful cookie middleware is configured for localhost domains but not used by the SPA.
- `config/cors.php` — with the Vite dev proxy in place, CORS is effectively bypassed in development. (See Chapter 8 note: `config/cors.php` is not present in the repo, so the default `*` is assumed for production until hardened.)

## 5.7 File uploads

- Hotel logo: `image|mimes:jpeg,png,webp|max:2048` (2 MB), stored on the `public` disk, old file deleted on replacement.
- Room images: managed via `RoomImageController` with similar image validation; stored paths referenced in `room_images.image_path`.

## 5.8 Spam protection

The contact form uses a **honeypot** (`website` field) that traps bots by silently accepting (201) but dropping the submission, plus the per-IP rate limit.

## 5.9 Known security caveats

- Tokens are stored in `localStorage` by the zustand stores (XSS-exposable; an `HttpOnly` cookie approach would be stricter).
- No password-reset flow exists (staff and guests can change passwords while logged in, but a "forgot password" email reset is absent).
- `reservations.no_show_by` has no DB foreign key constraint.
- See Chapter 8 for the complete list.

---

# Chapter 6. Testing & QA

## 6.1 Backend test suite (PHPUnit)

**177 tests passing, 484 assertions** (run with `php artisan test`, SQLite in-memory).

| Test file | Focus |
|---|---|
| `AuthAccessTest.php` | login validation, role gating (admin vs staff vs guest), 401/403 behavior, deactivated accounts |
| `ReservationIntegrityTest.php` | double-booking overlap (create + date-change + room-change), room reconciliation on cancel/delete |
| `InvoicePaymentTest.php` | invoice → reservation paid-amount sync, un-marking a paid invoice reverts totals |
| `GuestDeletionTest.php` | deletion blocked when reservation history exists (admin + portal) |
| `NoShowTest.php` | overdue flagging, no-show marking, state transitions |
| `PaymentRecomputeTest.php` | payment create/update recomputes paid/due/payment_status |
| `ReservationsPageTest.php` | full check-in/out with payment guards (unpaid rejected, pending-GCash allowed for check-in, partial rejected for check-out, settled allowed), `recordPayment()` helper mirrors `PaymentController::store` |
| `PortalTest.php` | 75 tests: registration, login, profile, password, account deletion, rooms, availability, reservation create/list/show/cancel, payments, contact, public settings, RBAC isolation, activity logging |
| `RecentActivitiesTest.php` | activity-log feed |
| `ExampleTest.php` | framework smoke test |

Test utilities create guests, room types, rooms, settings, and reservations with dynamic dates so the overlap/pricing logic is exercised against real data.

## 6.2 Frontend test suite (Vitest + Testing Library)

**39 tests passing across 4 test files** (run with `npm run test`):

- `PaymentModal.test.tsx` — cash/GCash flow, amounts, validation.
- `ReservationCheckInOutModal.test.tsx` — collect-vs-plain button per mode, retry collect visibility, full-settlement regression.
- `ReservationRowActions.test.tsx` — action gating per role/status.
- `useCheckInOutModal.test.ts` — payment-recorded retry logic (never double-creates a payment).

## 6.3 Static checks & build

- `npm run lint` → oxlint.
- `npm run build` → `tsc -b && vite build` (TypeScript type-check + production bundle).
- `composer` dev tooling: laravel/pint for code style, `laravel/pail` for local logs.

---

# Chapter 7. Setup, Deployment & Operation

## 7.1 Local development

Backend (terminal 1):

```bash
cd backend
composer install
copy .env.example .env          # then edit DB_* to point at MySQL
php artisan key:generate
php artisan migrate --seed
php artisan storage:link        # required for hotel logo + room images
php artisan serve               # http://localhost:8000
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api → :8000)
```

The `composer.json` also ships a `composer run dev` script that concurrently starts the server, a queue listener, `pail` logs, and Vite.

## 7.2 Seeded accounts

All seeded staff share the password `password`:

| Email | Role |
|---|---|
| `superadmin@hotel.com` | Super Admin |
| `admin@hotel.com` | Admin |
| `manager@hotel.com` | Hotel Manager |
| `reception@hotel.com` | Receptionist |
| `housekeeping@hotel.com` | Housekeeping |
| `cashier@hotel.com` | Cashier |
| `staff@hotel.com` | Staff |

Seeded guest accounts also use `password` (see `GuestSeeder`). Seeders populate room types (6), rooms (30 across 3 floors), reservations, payments, housekeeping, maintenance, activity logs, room images, settings, and contact info.

## 7.3 Scheduled tasks

`routes/console.php` schedules the no-show detector hourly:

```php
Schedule::command('reservations:detect-overdue')->hourly();
```

In production, run `php artisan schedule:work` (or a cron entry calling `schedule:run`).

## 7.4 Environment essentials

- `DB_CONNECTION=mysql`, `DB_DATABASE=hotel_management` (runtime); SQLite in-memory for tests.
- `SANCTUM_TOKEN_EXPIRATION` — default 24 hours (`1440` minutes).
- `BCRYPT_ROUNDS=12`.
- The `composer run setup` script automates install → .env → key:generate → migrate → npm build.

---

# Chapter 8. Known Limitations & Future Work

These are honest observations about the current system, verified against the code.

1. **No real payment gateway.** Payments are recorded manually as Cash or GCash; GCash "payment" is a reference-number record, not an integration with a PSP. Auto-verification of GCash and online card payments are future work.
2. **No refund workflow.** `PaymentController::destroy` refuses deletes ("Use refund instead"), but there is no dedicated refund form; a refund is modeled as a new payment with `payment_type = refund`. The portal explicitly forbids guests from recording refunds.
3. **No password reset.** `password_reset_tokens` table exists (Laravel default), but no forgot-password flow is exposed. Users can only change their password while logged in.
4. **Transition-map enforcement gap.** `ReservationController::update` enforces the transition map only for `cancelled`/`no_show` targets; other in-place status jumps (e.g. straight to `checked_in` via `update`) are not fully guarded the way the dedicated endpoints are.
5. **`reservations.no_show_by` has no FK constraint** — a schema oversight worth correcting with a proper migration.
6. **Inventory/purchasing is scaffold-only.** All tables and models exist, but there are no controllers, routes, or admin pages; the sidebar does not expose it.
7. **`config/cors.php` is absent from the repo**, so Laravel uses defaults (potentially permissive) — fine behind the Vite proxy, but production should pin allowed origins.
8. **Tokens in `localStorage`.** The zustand auth stores persist the bearer token in `localStorage`; HttpOnly cookies (Sanctum SPA auth) would be more XSS-resilient.
9. **`useSendInvoice`** references `POST /invoices/{id}/send`, which has **no corresponding backend route** (the route table only has index/store/show/update/destroy/pdf) — a dead frontend hook to remove or implement.
10. **Invoice numbering reuses IDs.** `BK-`/`INV-` sequences use `max(id)+1` within a year; deleting the highest-numbered record can cause a number to be reused. Also, `max(id)` is not safe under concurrent inserts without a lock (both create endpoints run inside DB transactions, mitigating but not eliminating the race).
11. **Portal vs admin cancel behavior differs.** Portal cancel sets the room `available` directly; admin cancel reconciles against other active reservations. The portal version could free a room that still has another active reservation.
12. **`legacy users.role` column** remains in the schema (all `'staff'`), kept for backward compatibility; canonical authorization reads `role_id → roles.slug`.

---

# Appendix A — Full Route Table

All routes from `backend/routes/api.php` (middleware column summarizes `auth:sanctum` and `role` requirements; `role:admin,staff` = any staff, `role:admin` = admin tier, `role:guest` = portal guest).

### Public (no authentication)

| Method | URI | Purpose |
|---|---|---|
| POST | `/api/portal/register` | Guest registration (`throttle:6,1`) |
| POST | `/api/portal/login` | Guest login (`throttle:6,1`) |
| POST | `/api/portal/contact` | Contact form (`throttle:contact` = 3/hr/IP) |
| GET | `/api/portal/rooms` | Room-type list w/ availability |
| GET | `/api/portal/rooms/available` | Available rooms for a date range |
| GET | `/api/portal/rooms/{slug}` | Room-type detail |
| GET | `/api/portal/settings/{group}` | Public settings by group |
| POST | `/api/login` | Staff login (`throttle:6,1`) |

### Guest portal (`auth:sanctum` + `role:guest`)

| Method | URI | Purpose |
|---|---|---|
| GET | `/api/portal/me` | Current guest |
| POST | `/api/portal/logout` | Revoke token |
| PUT | `/api/portal/profile` | Update profile |
| DELETE | `/api/portal/profile` | Delete account |
| PUT | `/api/portal/password` | Change password |
| GET | `/api/portal/reservations` | My reservations |
| POST | `/api/portal/reservations` | Book by room type |
| GET | `/api/portal/reservations/{reservation}` | Reservation detail (owner only) |
| POST | `/api/portal/reservations/{reservation}/cancel` | Cancel (owner only) |
| POST | `/api/portal/payments` | Make a payment |

### Staff (operational — `auth:sanctum` + `role:admin,staff`)

| Method | URI | Purpose |
|---|---|---|
| GET | `/api/me` | Current staff user |
| POST | `/api/logout` | Revoke token |
| PUT | `/api/profile` | Update own profile |
| PUT | `/api/password` | Change own password |
| GET | `/api/dashboard/stats` | KPI stats |
| GET | `/api/dashboard/revenue` | 30-day revenue/bookings |
| GET | `/api/dashboard/occupancy` | 30-day occupancy |
| GET | `/api/dashboard/booking-sources` | Source breakdown |
| GET | `/api/dashboard/recent-activities` | Latest 10 activity entries |
| GET | `/api/dashboard/top-room-types` | Top room types this month |
| GET | `/api/guests` / POST `/api/guests` | List / create guests |
| GET | `/api/guests/{guest}` / PUT | Show / update guest |
| GET | `/api/guests/{guest}/history` | Guest stay history |
| GET | `/api/reservations` / POST | List / create reservations |
| GET | `/api/reservations/{reservation}` / PUT / DELETE | Show / update / delete |
| POST | `/api/reservations/{reservation}/cancel` | Cancel |
| POST | `/api/reservations/{reservation}/check-in` | Check in |
| POST | `/api/reservations/{reservation}/check-out` | Check out |
| POST | `/api/reservations/{reservation}/no-show` | Mark no-show |
| GET | `/api/rooms` / GET `/api/rooms/available` / GET `/api/rooms/{room}` | Room queries |
| PUT | `/api/rooms/{room}/status` | Update room status (operational) |
| GET | `/api/room-types` / GET `/{room_type}` | Room-type queries |
| GET | `/api/payments` / POST / GET / PUT | Payment CRUD (destroy disabled) |
| GET | `/api/invoices` / POST / GET / PUT | Invoice CRUD |
| GET | `/api/invoices/{invoice}/pdf` | PDF export |
| GET | `/api/housekeeping` / POST / GET / PUT | Housekeeping CRUD |
| PUT | `/api/housekeeping/{task}/status` | Task status |
| POST | `/api/housekeeping/{task}/assign` | Assign task |
| GET | `/api/maintenance` / POST / GET | Maintenance CRUD |
| GET | `/api/search` | Global search |
| GET | `/api/staff/assignable` | Active staff for dropdowns |

### Admin-only (`auth:sanctum` + `role:admin`)

| Method | URI | Purpose |
|---|---|---|
| GET | `/api/activity-logs` | Activity log list |
| GET | `/api/contact-messages` / GET `/{id}` / DELETE | Inquiries inbox |
| GET | `/api/expenses` / POST / GET / PUT / DELETE | Expense CRUD |
| DELETE | `/api/guests/{guest}` | Delete guest (blocked w/ history) |
| DELETE | `/api/housekeeping/{task}` | Delete task |
| PUT | `/api/maintenance/{request}` / DELETE | Update / delete request |
| POST | `/api/maintenance/{request}/assign` | Assign request |
| PUT | `/api/maintenance/{request}/status` | Change request status |
| GET | `/api/roles` | Role list |
| GET/POST | `/api/room-types` / GET / PUT / DELETE `/{room_type}` | Room-type CRUD |
| POST | `/api/rooms` / PUT / DELETE `/{room}` | Room create/update/delete |
| PUT | `/api/rooms/{room}/status` | Status override (admin-only variant) |
| GET | `/api/rooms/{room}/images` / POST | Room image management |
| PUT | `/api/rooms/{room}/images/{image}` / DELETE | Room image update/delete |
| POST | `/api/reservations/refresh-overdue` | Run overdue detection |
| GET | `/api/reports/revenue` / occupancy / reservations | Reports |
| GET | `/api/reports/export/{type}` | CSV export |
| GET | `/api/settings` / PUT | Settings CRUD |
| GET | `/api/settings/{group}` | Settings by group |
| POST | `/api/settings/logo` / DELETE | Logo upload/remove |
| GET | `/api/staff` / POST | Staff list/create |
| GET | `/api/staff/{user}` / PUT | Staff show/update |
| GET | `/api/staff-schedules` / POST | Schedules |
| GET | `/api/leave-requests` / POST | Leave requests |
| PUT | `/api/leave-requests/{leaveRequest}` | Approve/update leave |

*(Framework routes: `GET /`, `GET sanctum/csrf-cookie`, `GET storage/{path}`, `GET /up`.)*

---

# Appendix B — Settings Keys

Seeded by `SettingsSeeder` (default values shown) and grouped by `SettingController::groupForKey()`.

| Key | Default | Group |
|---|---|---|
| `hotel_name` | Pampanga Home Suites | hotel |
| `hotel_address` | Pampanga, Philippines | hotel |
| `hotel_phone` | +63 912 345 6789 | hotel |
| `hotel_email` | info@pampangahomesuites.com | hotel |
| `default_currency` | PHP | hotel |
| `timezone` | Asia/Manila | hotel |
| `hotel_logo` | *(uploaded file path)* | hotel |
| `tax_name` | VAT | tax |
| `tax_rate` | 10 | tax |
| `default_discount` | 0 | booking |
| `cancellation_policy` | Free cancellation up to 24 hours before check-in | booking |
| `max_advance_days` | 30 | booking |
| `early_checkin_fee` / `late_checkout_fee` | *(accepted by groupForKey)* | booking |
| `contact_heading` | Get in Touch | contact |
| `contact_description` | Have a question or special request?... | contact |
| `contact_reception_hours` | 24 / 7 — Always Open | contact |
| `contact_facebook` / `contact_instagram` / `contact_tiktok` | # | contact |
| `contact_map_embed_url` | Google Maps embed (Pampanga) | contact |
| `contact_faq` | JSON array of Q/A | contact |
| `password_min_length` / `session_timeout` / `max_login_attempts` / `two_factor_auth` | *(accepted by groupForKey)* | security |
| *(anything else)* | | general |

---

*Documentation generated from the live codebase. Backend test suite: 177 tests / 484 assertions green. Frontend: 39 tests green (Vitest). Framework: Laravel 13.21.1 · React 19 · MySQL (runtime) / SQLite (tests).*
