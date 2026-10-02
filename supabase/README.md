# CleanEazy Supabase backend

Project ref: `jcckvihjumqdmkcbaebo`

The live project stores customers, services, orders, order items, payments, subscriptions, reminders, WhatsApp messages, service-rate history, business settings, staff roles, and backup audit records. The business tables use Row Level Security. Anonymous users cannot read customer data or create records. Staff can run day-to-day workflows; administrator actions include team access, reminders, settings, and backup restore.

## Database operations

- `create_laundry_order` calculates and records orders and line items in one transaction. Repeating the same idempotency key returns the existing order.
- `record_laundry_payment` validates a positive payment against the current balance, saves the payment date and notes, and prevents duplicates by idempotency key.
- `change_order_status` plus database triggers enforce the exact forward-only pickup-to-delivery sequence and timestamps.
- KG-based order items refresh each active subscription's weekly usage.
- `queue_due_reminders()` queues due reminders idempotently. The active `cleaneazy-reminders-hourly` Supabase Cron job runs at minute 5 each hour.
- `restore_cleaneazy_backup` is an authenticated, administrator-only RPC. Its public wrapper runs as the signed-in caller and delegates to an admin-checked function in the private schema.

## Edge Functions

- `manage-staff` requires JWT verification. It supports listing staff, sending invitations, and changing staff roles/status. It refuses self-edits and protects the last active administrator.
- `send-whatsapp` is deployed with gateway JWT verification disabled because it performs its own authentication: active staff JWT or the Vault-backed Cron secret in `x-cron-secret`.
- `whatsapp-webhook` is deployed with gateway JWT verification disabled because Meta signs webhook requests. It verifies `X-Hub-Signature-256` with `META_APP_SECRET` before processing delivery states.

## Meta WhatsApp setup

Set these as Supabase Edge Function secrets. Do not put them in the website or GitHub:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_API_VERSION` (optional; defaults to `v23.0`)
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WA_TEMPLATE_ORDER_RECEIVED`
- `WA_TEMPLATE_PICKUP_ASSIGNED`
- `WA_TEMPLATE_PICKED_UP`
- `WA_TEMPLATE_PROCESSING`
- `WA_TEMPLATE_WASHING_STARTED`
- `WA_TEMPLATE_IRONING`
- `WA_TEMPLATE_QUALITY_CHECK`
- `WA_TEMPLATE_READY`
- `WA_TEMPLATE_OUT_FOR_DELIVERY`
- `WA_TEMPLATE_DELIVERED`
- `WA_TEMPLATE_PAYMENT_CONFIRMATION`
- `WA_TEMPLATE_OUTSTANDING_REMINDER`

Meta must approve the templates before messages can send. Use a body with seven variables matching the sender: customer name, order number, event, total, paid, balance, and event detail.

Webhook URL: `https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/whatsapp-webhook`.

The WhatsApp queue and retry logic are live, but actual delivery is not verified until the Meta credentials and approved templates are configured.

## Authentication

Auth sign-up is invitation-only. The existing first Auth account is the initial CleanEazy administrator. Add the deployed software URL to Supabase Auth's allowed redirect URLs so invitations and password resets return to `/software/`. Enable leaked-password protection in Auth settings.

## Public booking contact

Set the confirmed public WhatsApp contact in `assets/site-config.js` as country-code digits only. The current database value appears to be placeholder data and is intentionally not copied to the public site.

