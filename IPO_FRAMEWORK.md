# IPO CONCEPTUAL FRAMEWORK
## Hotel Management System — Pampanga Home Suites

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INPUT (Requirements & Resources)                          │
├────────────────────────┬────────────────────────┬───────────────────────────────────┤
│   Functional           │   Non-Functional        │   Technology Stack               │
│   Requirements         │   Requirements          │                                   │
├────────────────────────┼────────────────────────┼───────────────────────────────────┤
│ • Guest Portal          │ • Security              │ • Laravel 11 (Backend)            │
│   - Registration/Login  │   - Password complexity │ • React 18 + TypeScript (Frontend)│
│   - Room Browsing       │   - Rate limiting       │ • MySQL 8 (AWS RDS)              │
│   - Booking Wizard      │   - RBAC roles          │ • Tailwind CSS                    │
│   - Online Payment      │   - OTP verification    │ • Vite (Build tool)              │
│   - My Reservations     │   - Sanctum tokens      │                                   │
│   - Reviews             │                         │ • AWS EC2 (Hosting)               │
│   - Contact Form        │ • Performance           │ • nginx (Web server)              │
│                         │   - DB indexing          │ • Let's Encrypt (SSL)            │
│ • Admin Dashboard       │   - Query optimization  │ • Gmail SMTP (Email)             │
│   - Room Management     │   - Caching              │ • PayMongo (Payments)            │
│   - Reservation System  │                         │                                   │
│   - Guest Management    │ • Usability             │ • PHP 8.4                         │
│   - Housekeeping        │   - Responsive design   │ • Docker (Containerization)      │
│   - Maintenance         │   - Dark navy theme     │ • Git (Version control)          │
│   - Staff Management    │   - Accessibility       │                                   │
│   - Expenses            │                         │                                   │
│   - Invoices/Payments   │                         │                                   │
│   - Reports             │                         │                                   │
│   - Settings            │                         │                                   │
│   - Activity Logs       │                         │                                   │
└────────────────────────┴────────────────────────┴───────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PROCESS (Development Activities)                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 1. Systems  │──▶│ 2. Database │──▶│ 3. Backend  │──▶│ 4. Frontend │            │
│  │   Analysis  │   │   Design    │   │   API Dev   │   │   UI Dev    │            │
│  │ & Planning  │   │ & Schema    │   │ (Laravel)   │   │  (React)    │            │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘            │
│         │                                    │                 │                    │
│         ▼                                    ▼                 ▼                    │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 5. Security │──▶│ 6. Payment  │──▶│ 7. Email    │──▶│ 8. Testing  │            │
│  │   Implemen- │   │   Gateway   │   │   System    │   │ & QA        │            │
│  │   tation    │   │ Integration │   │   Setup     │   │ (464 + 259) │            │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘            │
│         │                                    │                 │                    │
│         ▼                                    ▼                 ▼                    │
│  ┌─────────────┐   ┌─────────────────────────────────────────────────┐            │
│  │ 9. Deploy-  │──▶│ 10. Documentation & Validation                  │            │
│  │    ment     │   │     - SYSTEM_DOCUMENTATION.md                   │            │
│  │ (AWS EC2)   │   │     - API documentation                         │            │
│  └─────────────┘   │     - Deployment blueprints                     │            │
│                    └─────────────────────────────────────────────────┘            │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT (Deliverables)                                     │
├────────────────────────┬────────────────────────┬───────────────────────────────────┤
│   Working System       │   Technical Assets      │   Documentation                  │
├────────────────────────┼────────────────────────┼───────────────────────────────────┤
│ • Guest Portal          │ • 464 backend tests     │ • SYSTEM_DOCUMENTATION.md        │
│   - pampangahomesuites  │   passing (1500+        │ • .docx export                   │
│     .duckdns.org        │   assertions)           │ • Database schema                │
│                         │ • 259 frontend tests    │   (29 migrations)                │
│ • Admin Dashboard       │   passing               │ • API endpoint reference         │
│   - /admin              │ • 60+ REST API          │ • Deployment guide               │
│                         │   endpoints             │ • Operations manual              │
│ • Online Payment        │ • 25 room types         │                                   │
│   Gateway (PayMongo)    │   & images              │                                   │
│                         │ • Activity logging      │                                   │
│ • Email System          │   system                │                                   │
│   (SMTP + OTP)          │                         │                                   │
│                         │                         │                                   │
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
### Institution: Pampanga Home Suites
### Date: September 2026
