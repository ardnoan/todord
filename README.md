# Ruang

Ruang is a responsive Indonesian task planner with Supabase email/password authentication and live database sync.

## Features

- Today, Upcoming, Inbox, and Completed views
- Quick-add tasks and detailed task editing
- Due dates, categories, priorities, notes, and subtasks
- Live sync across signed-in devices
- Responsive layout for desktop and mobile

## Supabase setup

1. Create a Supabase project.
2. In **Project Settings → API Keys** (or the project **Connect** dialog), copy the Project URL and the **publishable** key (`sb_publishable_...`) into `.env`.
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor. It creates the tasks table, owner-only RLS policies, and enables Realtime.
4. In **Authentication → Providers**, make sure Email is enabled.
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and add it to the redirect URLs.
6. Run `npm install`, then `npm run dev`.

The app stores tasks in `public.tasks`; row-level security restricts every operation to the signed-in owner. Never put a Supabase `service_role` key in this frontend.

## Hosting on Vercel

Import the repository into Vercel and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as project environment variables, then deploy. After deployment, set the deployed URL as the Supabase **Site URL** and add it to the allowed redirect URLs under **Authentication → URL Configuration**.

The local `.env` file is ignored by Git. Add the same variables to Vercel's environment settings separately; do not commit credentials.

## Commands

- `npm run dev` — start the development server
- `npm run build` — type-check and create a production build
- `npm run preview` — preview the production build
