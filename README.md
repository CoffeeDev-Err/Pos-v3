# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Environment variables

Create a local `.env` file from `.env.example` if you need to override the Laravel API URL.

## Laravel backend with XAMPP MySQL

The React app now calls a Laravel API by default at `http://127.0.0.1:8000/api`.

Backend setup:

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Database setup:

- Start Apache/MySQL from XAMPP.
- Create a MySQL/MariaDB database named `pos_system`.
- Configure `backend/.env` with your local database and initial admin values.

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pos_system
DB_USERNAME=root
DB_PASSWORD=

POS_ADMIN_NAME="Store Owner"
POS_ADMIN_USERNAME=owner
POS_ADMIN_EMAIL=owner@example.local
POS_ADMIN_PASSWORD=
```

Frontend setup:

```bash
npm install
npm run dev
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
