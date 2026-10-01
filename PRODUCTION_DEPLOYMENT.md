# CleanEazy Laundry Production Deployment

## Web app
The production web app is in `software/index.html` with `manifest.webmanifest`, `sw.js`, and `icon.svg`.
It is responsive and is designed for Android Chrome, iPhone Safari, desktop Chrome/Edge, and PWA installation.

For GitHub Pages, publish the repository root from the `main` branch. The application path is:
`/software/`

Canonical production URL:
`https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/`

Custom domain is intentionally not used. The `CNAME` file has been removed from the repository and the GitHub Pages custom domain has been removed. Do not point `cleaneazy.in` to this application unless a custom domain is intentionally re-enabled later.

## Supabase
Project ref: `jcckvihjumqdmkcbaebo`
Project URL: https://jcckvihjumqdmkcbaebo.supabase.co

The database and RPCs are already deployed. Frontend uses only the Supabase publishable key. Service-role/secret keys are server-side only.

## Meta WhatsApp Cloud API
Required Supabase Edge Function secrets:
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_API_VERSION (optional)
- WHATSAPP_VERIFY_TOKEN
- One approved template system name per event:
  WA_TEMPLATE_ORDER_RECEIVED
  WA_TEMPLATE_PICKUP_ASSIGNED
  WA_TEMPLATE_PICKED_UP
  WA_TEMPLATE_PROCESSING
  WA_TEMPLATE_WASHING_STARTED
  WA_TEMPLATE_IRONING
  WA_TEMPLATE_QUALITY_CHECK
  WA_TEMPLATE_READY
  WA_TEMPLATE_OUT_FOR_DELIVERY
  WA_TEMPLATE_DELIVERED
  WA_TEMPLATE_PAYMENT_CONFIRMATION
  WA_TEMPLATE_OUTSTANDING_REMINDER

The current Edge Function never uses WhatsApp Web, SendKeys, AppActivate, or browser focus automation.

Meta template body can use these seven variables:
Hello {{1}} 👋
Your CleanEazy Laundry order {{2}} has an update: {{3}}.
Total: ₹{{4}}
Paid: ₹{{5}}
Balance: ₹{{6}}
{{7}}
Thank you for choosing CleanEazy Laundry.

{{7}} is "Expected delivery: <date>" for order/status messages and "Payment: ₹<amount>" for payment confirmation.

## Webhook
Configure Meta webhook URL:
https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/whatsapp-webhook
Verify token: same value as `WHATSAPP_VERIFY_TOKEN`

Subscribe to the message status events needed by the WhatsApp Cloud API integration. The webhook updates queued message rows with sent/delivered/read/failed state.

## Scheduler
Supabase Cron job: `cleaneazy-reminders-hourly`
Schedule: `5 * * * *`
The live job calls `queue_due_reminders()` and invokes `send-whatsapp` through `pg_net`. The internal cron secret is generated and stored in Supabase Vault and is passed to the worker in the `x-cron-secret` header, not in the URL.

## Security
Do not commit Meta access tokens, phone-number credentials, Supabase service-role keys, or other secrets into this public repository.
