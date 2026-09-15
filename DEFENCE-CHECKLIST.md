# Defence Day Checklist
### Pampanga Home Suites — Hotel Management System
> **Only bring your laptop (second device). PC stays at home.**

---

## Before Leaving Home

```
□ Pull latest from GitHub
  cd C:\hotel_2
  git pull origin main

□ Test locally
  cd C:\hotel_2\frontend && npm run dev
  Open http://localhost:5173 — check everything works

□ If you made changes on PC and didn't push:
  PC: git push origin main
  Laptop: git pull origin main
```

## At School — Verify Site Works

```
□ Open https://pampangahomesuites.duckdns.org
  - Hero section loads? ✓
  - Rooms page works? ✓
  - Contact form works? ✓

□ Open https://pampangahomesuites.duckdns.org/admin
  - Login: palayjohncarlo@gmail.com / password
  - Dashboard loads? ✓
  - Rooms/Guests/Reservations tabs work? ✓

□ Check API
  https://pampangahomesuites.duckdns.org/api/public/rooms
  Should return JSON list of rooms
```

## If You Find a Bug — Fix & Deploy

```
1. Fix the file on your laptop
2. Test locally: npm run dev
3. Push to GitHub:
   cd C:\hotel_2
   git add .
   git commit -m "fix: description of what you fixed"
   git push origin main

4. Deploy to server:
   ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www && sudo bash deploy.sh"

5. Verify on live site
```

## If Deploy Breaks Something

```
QUICK REVERT (30 seconds):
  ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www/hotel && sudo git revert HEAD --no-edit && sudo bash deploy.sh"

FULL REVERT (go back 2 commits):
  ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www/hotel && sudo git revert HEAD~1 --no-edit && sudo bash deploy.sh"

RESTART SERVICES (if site is completely down):
  ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "sudo systemctl restart nginx php8.4-fpm"
```

## If Site Is Completely Down

```
1. Check if server is reachable:
   ssh -i C:\hotel_2\hotel-v2.pem -o ConnectTimeout=5 ubuntu@3.80.68.104 "echo OK"

2. If SSH works — restart services:
   ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "sudo systemctl restart nginx php8.4-fpm"

3. Check error logs:
   ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "tail -30 /var/www/hotel/backend/storage/logs/laravel.log"

4. If it's a code bug — revert and redeploy:
   ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www/hotel && sudo git revert HEAD --no-edit && sudo bash deploy.sh"
```

## Key Info

| Item | Value |
|---|---|
| **Website** | https://pampangahomesuites.duckdns.org |
| **Admin** | https://pampangahomesuites.duckdns.org/admin |
| **Admin Login** | `palayjohncarlo@gmail.com` / `password` |
| **EC2 IP** | `3.80.68.104` |
| **SSH Key** | `C:\hotel_2\hotel-v2.pem` |
| **SSH User** | `ubuntu` |
| **DB Host** | `hotel-db.citymo8cssdy.us-east-1.rds.amazonaws.com` |
| **DB Name** | `hotel_management` |
| **DB User** | `hotel_admin` |
| **GitHub Repo** | https://github.com/DarkSelion/hotel-management-system_V2 |
| **AWS Profile** | `hotel` (us-east-1) |
| **Deploy Command** | `ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www && sudo bash deploy.sh"` |

## Server Architecture

```
EC2 (Ubuntu 24.04, t3.micro)
├── Nginx (web server, SSL via Let's Encrypt)
├── PHP 8.4-FPM (Laravel backend)
├── MariaDB (local fallback)
└── Frontend (React built to /var/www/hotel/frontend/dist)

RDS (MySQL, db.t4g.micro)
└── hotel_management database (production data)

DNS
└── DuckDNS → 3.80.68.104 (EC2 public IP)

SSL
└── Let's Encrypt (auto-renews, expires Dec 2, 2026)
```

## Quick Commands Cheat Sheet

```bash
# === LOCAL (laptop) ===
cd C:\hotel_2
git pull origin main                    # sync with GitHub
git add . && git commit -m "msg"        # stage + commit
git push origin main                    # push to GitHub

# === DEPLOY ===
ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www && sudo bash deploy.sh"

# === SERVER CHECK ===
ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "sudo systemctl status nginx php8.4-fpm"
ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "tail -20 /var/www/hotel/backend/storage/logs/laravel.log"

# === EMERGENCY ===
ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "sudo systemctl restart nginx php8.4-fpm"
ssh -i C:\hotel_2\hotel-v2.pem ubuntu@3.80.68.104 "cd /var/www/hotel && sudo git revert HEAD --no-edit && sudo bash deploy.sh"
```

## If Defender Asks "How do you deploy?"

> "I push code to GitHub from my development machine. The production server on AWS EC2 pulls from GitHub using a deploy script that runs migrations, builds the frontend, caches Laravel configs, and restarts services. Rollback is a single git revert command."

---

**Remember**: You cannot permanently break the site. Worst case, you revert and redeploy in under a minute.
