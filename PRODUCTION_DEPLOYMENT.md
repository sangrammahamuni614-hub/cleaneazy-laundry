# CleanEazy production setup

## GitHub Pages

Repository: <https://github.com/sangrammahamuni614-hub/cleaneazy-laundry>

The live Pages configuration publishes the `main` branch from the repository root. The canonical URLs are:

- Public site: <https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/>
- Management app: <https://sangrammahamuni614-hub.github.io/cleaneazy-laundry/software/>

No custom domain is used. Do not add a `CNAME` file or publish a second management route.

## Supabase

- Project ref: `jcckvihjumqdmkcbaebo`
- Project URL: <https://jcckvihjumqdmkcbaebo.supabase.co>
- Frontend uses the publishable key only.
- Auth sign-up is invitation-only. The first existing Auth user is the initial administrator; use the sign-in page's password reset if needed.
- Configure the GitHub Pages `/software/` URL in Supabase Auth's allowed redirect URLs so invitation and password-reset links return to the app.

`manage-staff` uses the Supabase server-side service key internally and is deployed with JWT verification enabled. Never add that key to repository files.

## WhatsApp Cloud API

The send worker and webhook are deployed, but message delivery remains disabled until Meta credentials and approved templates are set in Supabase Edge Function secrets:

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

Webhook URL: `https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/whatsapp-webhook`. The existing hourly Supabase Cron job queues due subscription-expiry and manual reminders, then calls the send worker using its Vault-backed secret.

No WhatsApp Web, browser automation, or client-side Meta secrets are used.

## Public booking contact

The public booking CTA is ready to open WhatsApp once the public business number is confirmed. Set `whatsappNumber` in `assets/site-config.js` to country-code digits (for India, `91` followed by the number). The value already stored in Supabase looks like a placeholder, so it was not published. No confirmed public business email is configured.

## Remaining owner setup

1. Confirm the public phone and WhatsApp number, and the public business email if one should appear on the site.
2. Configure Meta WhatsApp Cloud API credentials and approve the templates listed in `supabase/README.md`.
3. Enable Supabase Auth leaked-password protection in the project's Auth password settings.
4. Sign in to the deployed `/software/` page with the administrator's existing credentials and invite any staff accounts.

