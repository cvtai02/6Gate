# Telegram Provider Plan

## Goal

Add Telegram as a first-class provider without implementing it in the current migration commit. Telegram should use `TelegramChat` as its destination type and support publishing uploaded videos to Telegram chats/channels through a bot token.

## Scope

- Add `ProviderType.telegram`.
- Add `DestinationType.TelegramChat`.
- Add a Telegram provider adapter in the Nest backend.
- Add a token-based account flow, since Telegram does not use the same OAuth flow as YouTube, Meta, or TikTok.
- Add frontend provider cards, destination labels, colors, abbreviations, and icon support.
- Keep the UI consuming backend APIs through `api-clients`.

## Backend Changes

1. Update shared backend enums in `app/src/lib/enums.ts`.
   - `ProviderType.telegram = "telegram"`
   - `DestinationType.TelegramChat = "TelegramChat"`
   - `Providers[ProviderType.telegram]` should expose Telegram with `TelegramChat`.

2. Add `app/src/server/providers/telegram.adapter.ts`.
   - Implement `SocialProviderAdapter`.
   - `getAuthUrl` and `handleOAuthCallback` should clearly reject OAuth usage or route to token setup.
   - `refreshToken` should be a no-op.
   - `publishVideo` should call Telegram Bot API `sendVideo`.

3. Register the adapter in `app/src/server/providers/registry.ts`.

4. Update `app/src/server/providers/adapter-utils.ts`.
   - Map Telegram to `TelegramChat`.
   - Do not require `clientId` for Telegram.
   - Treat `clientSecret` or a dedicated account token as the bot token.

5. Add a token-based account endpoint.
   - Suggested path: `POST /api/accounts/telegram/add`
   - Body: `botToken`, `chatId`, optional `chatName`, optional `providerId`.
   - Create or reuse a Telegram provider.
   - Create a Telegram account with the bot token stored as the account access token.
   - Create a `TelegramChat` destination using `chatId` as `externalId`.

6. Optional Zernio compatibility.
   - If Zernio sync exposes Telegram accounts, map Zernio platform `telegram` to `TelegramChat`.

## Frontend Changes

1. Update `ui/src/lib/enums.ts` with the same provider and destination entries.

2. Add `ui/public/icons/telegram.svg`.

3. Update destination icon maps.
   - `ui/src/lib/destination-icons.ts`
   - `app/src/lib/destination-icons.ts`

4. Add Telegram provider card metadata in `ui/src/app/providers/page.tsx`.

5. Add `TelegramChat` labels, abbreviations, and colors in pages that render destinations.
   - `ui/src/app/providers/[type]/page.tsx`
   - `ui/src/app/groups/page.tsx`
   - `ui/src/app/combos/page.tsx`
   - `ui/src/app/jobs/jobs-table.tsx`
   - `ui/src/app/jobs/[id]/page.tsx`

6. Add a Telegram account setup form.
   - Inputs: bot token, chat ID, display name.
   - Submit to `POST /api/accounts/telegram/add`.

## Publish Behavior

- Use `sendVideo` for video jobs.
- Use `chat_id` from the destination `externalId`.
- Use the job caption as Telegram `caption`.
- Return Telegram `message_id` as `providerPostId`.
- If the chat has a public username, build a best-effort post URL.

## Tests

- Backend unit test for Telegram account creation.
- Backend adapter test mocking Telegram Bot API.
- API test for `POST /api/accounts/telegram/add`.
- Group upload test targeting `TelegramChat`.
- UI smoke test for Telegram provider setup and group destination selection.

## Notes

Telegram channels and groups require the bot to be added to the chat. For channels, the bot usually needs posting permissions. The UI should explain that briefly beside the token/chat setup form.
