# Discord + Telegram Personal Information Bot

A production-quality, personal backend integration bot that connects Discord servers and Telegram

This is a backend service with **no Web UI, dashboard, or frontend**. The user interface operates entirely through Discord Slash Commands and Telegram bot commands / messages.

---

## 🚀 Features

- **Discord Member Join Monitoring**: Listens to Discord Gateway `GUILD_MEMBER_ADD` events across multiple guilds.
- **Rich Information Collection**: Gathers Discord User ID, username, display name, global name, server nickname, mention, avatar URL, bot flag, exact creation timestamp, exact join timestamp, guild ID, guild name, member count, and roles.
- **Calendar-Aware Account Age**: Formats account age as exact human-readable calendar durations (e.g., `5 years, 11 months, 14 days`), retaining exact UTC creation timestamps separately.
- **Discord Embed Notifications**: Posts a formatted join notification in the server's configured notification channel.
- **Telegram Direct Owner Alerts**: Instantly forwards join alerts to the configured `TELEGRAM_OWNER_ID` via Telegram Bot API.
- **Idempotency & Deduplication**: Prevents duplicate notification events if Gateway re-delivers member join events.
- **Telegram Remote Management**: Allows the authorized Telegram owner to run commands (`/start`, `/help`, `/status`, `/servers`, `/info <discord_user_id>`).
- **Strict Telegram Authorization**: Restricts administrative commands exclusively to `TELEGRAM_OWNER_ID` by numeric Telegram user ID.
- **Health & Webhook HTTP Endpoints**: Exposes `GET /health`, `GET /ready`, and `POST /api/telegram/webhook` with secret token header validation (`X-Telegram-Bot-Api-Secret-Token`).

---

## 📐 Architecture

```
                               ┌─────────────────────────┐
                               │     Discord Gateway     │
                               └────────────┬────────────┘
                                            │ GUILD_MEMBER_ADD
                                            ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│  Telegram Bot API       │◄───│  Member Processing      │───►│  Discord Guild Channel  │
│  (Owner Notification)   │    │  & Deduplication        │    │  (Embed Notification)   │
└─────────────────────────┘    └────────────┬────────────┘    └─────────────────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │   PostgreSQL Database   │
                               └─────────────────────────┘
                                            ▲
┌─────────────────────────┐                 │
│ Telegram Webhook Router │─────────────────┘
│ (POST /api/telegram/..) │
└─────────────────────────┘
```

The application is cleanly modularized under `src/`:
- `src/config/`: Zod environment validation and configuration loader.
- `src/database/`: PostgreSQL connection pool, schema migrations runner, and repository.
- `src/discord/`: Discord Gateway client and event listeners.
- `src/telegram/`: Telegram Bot API wrapper, webhook registration, and diagnostics.
- `src/commands/`: Handlers for Discord slash commands and Telegram bot commands.
- `src/formatters/`: Notification formatters for Discord embeds and Telegram messages.
- `src/services/`: Core business logic (`MemberService`, `DiscordService`, `TelegramService`).
- `src/http/`: Node.js HTTP server exposing `/health`, `/ready`, and webhook route.
- `src/utils/`: Calendar-aware account age calculator, date formatters, and redacting logger.
- `src/types/`: TypeScript interface definitions.
- `src/tests/`: Automated unit and integration test suite.

---

## 🛠️ Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, name your app, and save.
3. In **General Information**, note down the **Application ID** (used as `DISCORD_CLIENT_ID`).
4. Go to **Bot** tab, click **Reset Token** to generate a bot token (used as `DISCORD_BOT_TOKEN`).
5. Enable required **Privileged Gateway Intents**:
   - **Server Members Intent** (`GUILD_MEMBERS`) - **REQUIRED** to detect member joins.
   - Do **NOT** enable Message Content Intent as it is not required.

---

## 🔒 Required Discord Permissions

The bot operates on minimum permissions and **does NOT require Administrator permission**.
When generating the bot invite link under **OAuth2 -> URL Generator**, select scope `bot` and `applications.commands`, with permissions:
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Read Message History`

---

## 🤖 Creating the Telegram Bot with BotFather

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow instructions to set a display name and username.
3. Copy the HTTP API token provided by BotFather (used as `TELEGRAM_BOT_TOKEN`).
4. (Optional) Run `/setuserpic` or `/setdescription` to customize your bot.

---

## 👤 Obtaining TELEGRAM_OWNER_ID Safely

1. Open Telegram and search for `@userinfobot` or `@raw_data_bot`.
2. Send any message or `/start`.
3. The bot will respond with your numeric Telegram User ID (e.g., `123456789`).
4. Use this numeric ID for `TELEGRAM_OWNER_ID`.

---

## 🐘 PostgreSQL Setup

Ensure PostgreSQL 14+ is running. Create a database:

```sql
CREATE DATABASE discord_telegram_bot;
```

Database connection string format:
`postgres://user:password@localhost:5432/discord_telegram_bot`

Schema migrations are automatically applied on startup from `src/database/migrations/`.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in your secrets:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DATABASE_URL=postgres://user:password@localhost:5432/discord_telegram_bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_OWNER_ID=123456789
TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret_here
APP_URL=https://your-domain.com
NODE_ENV=development
PORT=3000
```

---

## 💻 Local Development

1. Install dependencies: `npm install`
2. Run typecheck: `npm run typecheck`
3. Run lint: `npm run lint`
4. Run tests: `npm test`
5. Build project: `npm run build`
6. Run development server: `npm run dev`

---

## 🌐 Telegram Webhook Setup

Production Telegram integration uses webhooks instead of polling.
The service automatically registers the webhook on startup using:
`APP_URL + /api/telegram/webhook` with secret header `TELEGRAM_WEBHOOK_SECRET`.

To verify your webhook status via Telegram API:
```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## 🚢 Production Deployment

1. Build the production output: `npm run build`
2. Start the service: `npm start`
3. Ensure HTTPS is terminated at your reverse proxy (e.g. Nginx, Caddy, Cloudflare, Render) pointing to `PORT`.
4. Ensure `APP_URL` uses `https://`.

---

## 📋 Discord Bot Setup & Slash Commands

1. Invite the bot to your server using the generated OAuth2 URL.
2. An authorized Server Manager/Administrator must run `/setup` in the desired channel:
   - `/setup channel:#welcome enabled:true`
3. View settings: `/config`
4. Lookup a member: `/info user_id:123456789012345678`
5. View bot status: `/status`

---

## 🛠️ Troubleshooting

### Telegram Webhooks
- **Secret token mismatch**: Ensure `TELEGRAM_WEBHOOK_SECRET` matches in `.env`.
- **401 Unauthorized**: Requests missing `X-Telegram-Bot-Api-Secret-Token` header are rejected.
- **SSL/HTTPS requirement**: Telegram requires a valid HTTPS URL for `APP_URL`.

### Discord Gateway & Intents
- **Member join events not firing**: Ensure **Server Members Intent** is toggled ON in the Discord Developer Portal under Bot settings.
- **Slash commands not appearing**: Wait up to 1 minute for global command propagation or re-invite the bot with `applications.commands` scope.
- **Missing channel permissions**: Check that the bot has `Send Messages` and `Embed Links` in the configured channel.

---

## 🔒 Security Considerations

- **Secrets Redaction**: Loggers automatically redact tokens, database passwords, and secrets.
- **Strict Telegram User Authorization**: Checks numeric ID (`TELEGRAM_OWNER_ID`), never usernames.
- **Discord Server Permission Verification**: `/setup` and `/config` enforce `Manage Server` permission check on the backend.
- **Parameterized SQL**: All database queries use parameterized placeholders (`$1`, `$2`) to eliminate SQL injection risks.
- **Minimal Discord Permissions**: No Administrator permission required.
