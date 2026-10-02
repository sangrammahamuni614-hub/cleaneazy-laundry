# CleanEazy Laundry

CleanEazy's public website and private laundry desk live in this static GitHub Pages repository. The public site is at `/`; the only management application is `/software/`.

## Production URLs

- Website: <https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/>
- Team app: <https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/>
- Repository: <https://github.com/sangrammahamuni614-hub/cleaneazy-laundry>

The Pages site publishes the `main` branch from the repository root. No custom domain is configured.

## Business application

The web app uses Supabase Auth, PostgreSQL with RLS, and database RPCs. The frontend contains only the project's publishable key in `software/supabase-config.js`; it does not contain a service-role key. Accounts are invitation-only. The existing first Auth user is provisioned as the CleanEazy administrator.

The `/software/` desk includes customers, services and rate history, orders, invoices, payments, sequential order status, subscriptions, reminders, reports, WhatsApp queue, backup/restore, team access and business settings. Order and payment writes use transactional, idempotent RPCs. Reminder scheduling uses the existing hourly Supabase Cron job.

## Local preview

Serve the repository root over HTTP, for example with `python -m http.server 8080`, then visit `http://localhost:8080/` and `http://localhost:8080/software/`. Browser sign-in needs an internet connection to reach Supabase and its JS client.

## Supabase updates

The live project ref is `jcckvihjumqdmkcbaebo`. The SQL migration files under `supabase/migrations/` record the application-access, restore, and advisor-cleanup updates applied to the connected project. Edge Function source is under `supabase/functions/`.

Never commit Supabase secret/service-role keys, Meta access tokens, webhook secrets, or private customer exports. See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for external setup and remaining credentials.

