# AGENTS.md - Codebase Guidelines & System Architecture

This repository contains a production-quality, personal backend integration bot connecting Discord Gateway (as an event source) and Telegram (as the sole interface and notification destination).

## 🏗️ System Architecture

- **Runtime**: Node.js (v22+), TypeScript (Strict mode), ES Modules (`"type": "module"`).
- **Discord**: `discord.js` v14 (WebSocket Gateway event listener, Intents: `Guilds`, `GuildMembers`).
- **Telegram**: `grammy` (Webhook delivery in production, secret token verification).
- **Database**: PostgreSQL (`pg` driver with lightweight migration runner in `src/database/migrator.ts`).
- **HTTP Server**: Built-in Node `http` module listening on `PORT` for `/health`, `/ready`, `/api/telegram/webhook`.

---

## 📂 Folder Structure & Boundaries

```
src/
├── config/       # Environment loading & Zod schema validation
├── database/     # DB client pool, SQL migrations, repository layer
├── discord/      # Gateway client initialization and event wiring
├── telegram/     # Telegram Bot API wrapper, webhook registration
├── commands/     # Telegram command router (/start, /help, /status, /servers, /info)
├── formatters/   # Telegram HTML message formatters
├── services/     # Member join service, Telegram service, Discord service
├── http/         # Node HTTP server exposing webhook & health checks
├── utils/        # Account age calculator, date formatters, redacting logger
├── types/        # Core TypeScript interfaces
└── tests/        # Vitest test suite
```

---

## 📜 Coding Standards & Guidelines

1. **Strict TypeScript**: Do not use `any`. Use strict interfaces and types defined in `src/types/`.
2. **ES Modules**: Use `.js` extension in relative import paths (e.g., `import { foo } from './bar.js'`).
3. **No Web UI / Discord Channel Notifications**: Do NOT add web frontends or Discord channel notifications. Discord is strictly an event/data source.
4. **Secrets Security**:
   - Never log tokens, database passwords, or webhook secrets.
   - Always redact sensitive values in `Logger`.
   - Never expose tokens in API error responses.
5. **Telegram Authorization**:
   - Authenticate Telegram commands strictly against numeric `TELEGRAM_OWNER_ID`.
   - Reject unauthorized users with a short denial message without exposing internal details.
6. **Database Queries**:
   - Always use parameterized queries (`$1`, `$2`, etc.).
   - Wrap operations in try-catch and handle connection outages gracefully.
7. **Calendar-Aware Account Age**:
   - Do NOT produce floating-point ages (e.g., `2167.48 days`).
   - Use `calculateAccountAge()` to produce human-readable durations (e.g. `5 years, 11 months, 14 days`).

---

## 🧪 Testing & Verification Commands

Run these commands before committing or submitting changes:

```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Automated Vitest Suite
npm test

# Production Build
npm run build
```

---

## 🚫 Forbidden Practices

- DO NOT use Telegram polling in production when a webhook is configured.
- DO NOT request Message Content intent unless explicitly justified.
- DO NOT fabricate or claim unavailable Discord member information.
- DO NOT crash the Discord gateway process if Telegram delivery fails temporarily.
- DO NOT commit secrets, `.env`, or build artifacts.
