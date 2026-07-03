# POS v3

React/Vite frontend with a Laravel 12 API backend for the POS system.

## Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Root `.env.example` points the frontend to the local Laravel API at `http://127.0.0.1:8000/api`.

For local MySQL/XAMPP, update `backend/.env` with your database name and admin seed values.

## Deployment

This repo is prepared for:

- `Vercel` for the React frontend
- `Render` for the Laravel backend
- a managed `MySQL` database such as Aiven

Deployment notes and production env values are in [DEPLOY.md](DEPLOY.md).
