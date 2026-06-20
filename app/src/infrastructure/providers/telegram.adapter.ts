// Telegram is not a publish destination.
// It serves two roles:
// 1. Webhook hook: receives /queue commands to schedule uploads (handle-telegram-webhook.usecase.ts)
// 2. Notification: sends publish results back to chats (telegram-notify.ts)
