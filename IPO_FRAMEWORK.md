# IPO CONCEPTUAL FRAMEWORK
## Hotel Management System — Pampanga Home Suites

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INPUT (Requirements & Resources)                          │
├────────────────────────┬────────────────────────┬───────────────────────────────────┤
│   Functional           │   Non-Functional        │   Technology Stack               │
│   Requirements         │   Requirements          │                                   │
├────────────────────────┼────────────────────────┼───────────────────────────────────┤
│ • Guest Portal          │ • Security              │ • Laravel 11 + PHP 8.4           │
│   - Registration/Login  │   - Password complexity │ • React 18 + TypeScript          │
│   - Room Browsing       │   - Rate limiting       │ • MySQL 8 (AWS RDS)              │
│   - Booking Wizard      │   - RBAC roles          │ • Tailwind CSS + Vite            │
│   - Online Payment      │   - OTP verification    │ • AWS EC2 + nginx + SSL          │
│   - My Reservations     │   - Sanctum tokens      │ • Gmail SMTP + PayMongo          │
│   - Reviews             │                         │ • Git (Version control)          │
│   - Contact Form        │ • Performance           │                                   │
│                         │   - DB indexing          │                                   │
│ • Admin Dashboard       │   - Query optimization  │                                   │
│   - Room Management     │   - Caching              │                                   │
│   - Reservation System  │                         │                                   │
│   - Guest Management    │ • Usability             │                                   │
│   - Housekeeping        │   - Responsive design   │                                   │
│   - Maintenance         │   - Dark navy theme     │                                   │
│   - Staff Management    │   - Accessibility       │                                   │
│   - Expenses/Reports    │                         │                                   │
│   - Settings/Logs       │                         │                                   │
└────────────────────────┴────────────────────────┴───────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PROCESS (Development Activities)                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 1. Systems  │──▶│ 2. Database │──▶│ 3. Backend  │──▶│ 4. Frontend │            │
│  │  Analysis   │   │   Design    │   │   API Dev   │   │   UI Dev    │            │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘            │
│                          │                  │                 │                     │
│                          ▼                  ▼                 ▼                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 5. Security │──▶│ 6. Payment  │──▶│ 7. Email    │──▶│ 8. Testing  │            │
│  │  Implemen-  │   │   Gateway   │   │   System    │   │ & QA        │            │
│  │   tation    │   │ Integration │   │   Setup     │   │ (723 tests) │            │
│  └─────────────┘   └─────────────┘   └─────────────┘   └──────┬──────┘            │
│                                                               │                    │
│                          ┌────────────────────────────────────┘                    │
│                          ▼                                                         │
│                 ┌─────────────────┐                                                │
│                 │ 9. Deployment   │                                                │
│                 │   (AWS EC2)     │                                                │
│                 └─────────────────┘                                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT (Deliverables)                                     │
├────────────────────────┬────────────────────────┬───────────────────────────────────┤
│   Working System       │   Technical Assets      │   Documentation                  │
├────────────────────────┼────────────────────────┼───────────────────────────────────┤
│ • Guest Portal          │ • 464 backend tests     │ • IPO Framework                  │
│   pampangahomesuites    │ • 259 frontend tests    │ • Database schema (29 migrations)│
│   .duckdns.org          │ • 60+ REST API          │ • API endpoint reference         │
│ • Admin Dashboard       │   endpoints             │ • Deployment guide               │
│   /admin                │ • 5 room types          │                                   │
│ • PayMongo Gateway      │   & 25 rooms            │                                   │
│ • SMTP + OTP Email      │ • Activity logging      │                                   │
└────────────────────────┴────────────────────────┴───────────────────────────────────┘
```

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐               │
│  │   GUEST      │         │   ADMIN      │         │   PAYMENT    │               │
│  │   PORTAL     │         │   DASHBOARD  │         │   GATEWAY    │               │
│  │   (React)    │         │   (React)    │         │  (PayMongo)  │               │
│  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘               │
│         │                        │                        │                        │
│         ▼                        ▼                        ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐               │
│  │                    NGINX (Reverse Proxy + SSL)                  │               │
│  └──────────────────────────────┬──────────────────────────────────┘               │
│                                 │                                                  │
│                                 ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐               │
│  │                 LARAVEL 11 API (PHP 8.4)                        │               │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │               │
│  │  │ Auth       │  │ Booking    │  │ Payments   │  │ Admin    │ │               │
│  │  │ (Sanctum)  │  │ Controller │  │ Controller │  │ CRUD     │ │               │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │               │
│  └──────────────────────────────┬──────────────────────────────────┘               │
│                                 │                                                  │
│                                 ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐               │
│  │                    MySQL 8 (AWS RDS)                             │               │
│  │  guests | reservations | rooms | room_types | payments | ...    │               │
│  └─────────────────────────────────────────────────────────────────┘               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Capstone Student: John Carlo Palay
### Date: September 2026
