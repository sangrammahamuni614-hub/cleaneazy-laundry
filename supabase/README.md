# CleanEazy Production Backend

Project: jcckvihjumqdmkcbaebo

## Deployed backend
- Supabase Postgres: customers, services, orders, order_items, payments, subscriptions, reminders, whatsapp_messages, service_rate_history, business_settings, backup_exports, staff_users.
- RPC: create_laundry_order
- RPC: change_order_status
- RPC: record_laundry_payment
- RPC: order_outstanding
- Edge Function: send-whatsapp (JWT required)
- Edge Function: whatsapp-webhook (Meta webhook; JWT disabled because Meta calls it directly)

## WhatsApp Cloud API configuration
The Edge Function expects Supabase Edge Function secrets:
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_API_VERSION (optional; defaults to v23.0)
- WA_TEMPLATE_ORDER_RECEIVED
- WA_TEMPLATE_PICKUP_ASSIGNED
- WA_TEMPLATE_PICKED_UP
- WA_TEMPLATE_PROCESSING
- WA_TEMPLATE_WASHING_STARTED
- WA_TEMPLATE_IRONING
- WA_TEMPLATE_QUALITY_CHECK
- WA_TEMPLATE_READY
- WA_TEMPLATE_OUT_FOR_DELIVERY
- WA_TEMPLATE_DELIVERED
- WA_TEMPLATE_PAYMENT_CONFIRMATION
- WA_TEMPLATE_OUTSTANDING_REMINDER
- WHATSAPP_VERIFY_TOKEN (for webhook verification)
- META_APP_SECRET (for Meta X-Hub-Signature-256 webhook validation)

Never put the WhatsApp access token, phone-number credentials, service-role key, or Supabase secret key in frontend JavaScript or a public repository.

## Recommended generic template
Use one approved Meta template per event, with 7 body variables:
Hello {{1}} 👋
Your CleanEazy Laundry order {{2}} has an update: {{3}}.
Total: ₹{{4}}
Paid: ₹{{5}}
Balance: ₹{{6}}
{{7}}
Thank you for choosing CleanEazy Laundry.

The frontend queues messages in whatsapp_messages. The Edge Function sends them via the Meta Graph API. The webhook records provider status such as sent/delivered/read/failed.

## Important deployment note
Supabase Edge Function secrets and Meta Business Manager/WhatsApp template approvals must be configured in the owner's accounts. These account-level settings cannot be safely hard-coded into a public source repository.
