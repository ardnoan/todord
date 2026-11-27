# Ruang

Ruang is a responsive Indonesian productivity & personal finance planner with Supabase authentication, row-level security, and live database sync.

## Features

- **Dashboard Tugas**: Focus Today, Overdue tracking, Active/Completed task modals, Calendar & Activity Heatmap, custom task ordering, and Sticky Notes board (per-user synced).
- **Finance Manager**: Accounts, hierarchical Categories, Transactions (income, expense, transfer, adjustment) with server-side SQL aggregates & pagination, Budgets, anchored Recurring schedules with catch-up, Reports & Charts, and transactional CSV Import/Export.
- **Admin Parameters**: Global application settings (currency, budget warning threshold, task categories, default finance categories, module toggle) managed by admin users.
- **Tema & Tampilan**: 5 themes (`Sage Minimal`, `Malam Teduh` dark mode, `Kertas Hangat`, `Nordic Slate`, `Lavender Tenang`) and layout modes (`list`, `grid`, `compact`), synced per user.
- **Responsive & Desktop**: Mobile bottom navigation, contextual FAB, responsive table-to-card, bottom-sheet modals, PWA manifest, and optional Electron desktop build.

## Supabase setup

1. Create a Supabase project.
2. In **Project Settings → API Keys**, copy the Project URL and the **publishable** key (`sb_publishable_...`) into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Run `supabase/schema.sql` and all migration files in `supabase/migrations/` in chronological order in the Supabase SQL Editor.
4. In **Authentication → Providers**, make sure Email is enabled.
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and add it to the redirect URLs.
6. Run `npm install`, then `npm run dev`.

Never put a Supabase `service_role` key in this frontend.

## Hosting on Vercel

Import the repository into Vercel and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (and optionally `VITE_ADMIN_EMAILS`) as project environment variables, then deploy. After deployment, set the deployed URL as the Supabase **Site URL** and add it to the allowed redirect URLs under **Authentication → URL Configuration**.

## Commands

- `npm run dev` — start the development server
- `npm run build` — type-check and create a production build
- `npm run test` — run unit & component tests with Vitest
- `npm run lint` — run ESLint checks
- `npm run preview` — preview the production build
