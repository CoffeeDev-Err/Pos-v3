# Deployment Guide

This repo is prepared for a split deployment:

- Frontend: `Vercel`
- Backend API: `Render`
- Database: managed `MySQL`

As of July 3, 2026, this is the cleanest free-or-cheap path for the current stack.

## 1. Backend on Render

The repo now includes [render.yaml](render.yaml), [backend/Dockerfile](backend/Dockerfile), and [backend/start.sh](backend/start.sh).

Render setup:

1. In Render, create a new Blueprint deployment from the GitHub repo.
2. Render will detect `render.yaml` and create the `pos-v3-api` web service.
3. Set the missing environment variables shown in `sync: false`.

Use [backend/.env.production.example](backend/.env.production.example) as the source of truth.

Required backend values:

- `APP_URL=https://your-render-service.onrender.com`
- `FRONTEND_URL=https://your-vercel-project.vercel.app`
- `CORS_ALLOWED_ORIGINS=https://your-vercel-project.vercel.app`
- `DB_CONNECTION=mysql`
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `POS_ADMIN_NAME`, `POS_ADMIN_EMAIL`, `POS_ADMIN_PASSWORD`
- `POS_STORE_NAME`

Notes:

- The startup script runs `php artisan migrate --force` on boot.
- `SESSION_DRIVER=file`, `CACHE_STORE=file`, and `QUEUE_CONNECTION=sync` are used for simpler hosting on free tiers.
- If your MySQL provider requires SSL, set `MYSQL_ATTR_SSL_CA` to the CA certificate path provided by your host.

Health check:

- Render health check path is `/up`

## 2. Frontend on Vercel

The existing [vercel.json](vercel.json) is ready for SPA routing.

Vercel setup:

1. Import the same GitHub repo into Vercel.
2. Set the project root to the repo root.
3. Build command: `npm run build`
4. Output directory: `dist`

Set this frontend environment variable in Vercel:

- `VITE_API_BASE_URL=https://your-render-service.onrender.com/api`

Reference value: [.env.production.example](.env.production.example)

## 3. Database

The backend is configured for MySQL already, so you do not need to rewrite queries.

Recommended:

- Aiven free MySQL for demo/testing
- any paid MySQL host for real production use

If your provider gives a single connection URL, Laravel also supports `DB_URL`, but the current sample uses the standard `DB_HOST` style variables because they are easier to audit.

## 4. After first deploy

Check these URLs:

1. `https://your-render-service.onrender.com/up`
2. `https://your-render-service.onrender.com/api/products`
3. `https://your-vercel-project.vercel.app`

Then log in with the admin user created from the `POS_ADMIN_*` variables.

## Free tier caveat

Free hosting is okay for demo, portfolio, and testing. It is not ideal for an actual cashier/store workflow because:

- Render free web services sleep after inactivity and have cold starts
- free databases often have size or time limits
- Bluetooth printing still depends on browser/device support and secure context
