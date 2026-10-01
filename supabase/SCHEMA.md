# CleanEazy production schema

## Core
- customers: id, customer_code, full_name, whatsapp_number, address, customer_type, created_at, alternate_number, area, notes, is_active, whatsapp_number_normalized
- services: id, service_name, unit_type, rate, active, created_at, is_deleted, updated_at
- orders: id, order_number, customer_id -> customers.id, order_date, expected_delivery_date, status, subtotal, discount, total_amount, paid_amount, payment_status, notes, created_at, updated_at, invoice_number, pickup_status, pickup_requested_at, pickup_assigned_to, picked_up_at, washing_started_at, ready_at, out_for_delivery_at, delivered_at, reminder_at, last_customer_notification_at, idempotency_key
- order_items: id, order_id -> orders.id, service_id -> services.id, item_name, quantity, unit, rate, amount, created_at
- payments: id, order_id -> orders.id, amount, payment_method, payment_date, reference_number, notes, idempotency_key

## Operations
- subscriptions: id, customer_id -> customers.id, plan_name, start_date, expiry_date, weekly_limit_kg, used_kg, monthly_amount, active, notes, created_at, updated_at, usage_week_start, last_renewal_date
- reminders: id, customer_id -> customers.id, order_id -> orders.id, reminder_type, scheduled_at, message, status, sent_at, attempts, last_error, idempotency_key, created_at
- whatsapp_messages: id, order_id -> orders.id, customer_id -> customers.id, event, recipient, template_name, template_language, payload, status, attempts, next_attempt_at, sent_at, provider_message_id, last_error, idempotency_key, created_at, updated_at
- service_rate_history: id, service_id -> services.id, old_rate, new_rate, changed_at, changed_by

## Administration
- staff_users: user_id -> auth.users.id, display_name, role (admin/staff), active, created_at, updated_at
- business_settings: business profile and contact data (singleton id=1)
- backup_exports: backup audit rows

## Security
All business tables have RLS enabled. Frontend uses a publishable key. Secrets and provider credentials are server-side only.
