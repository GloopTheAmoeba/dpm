import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { createHttpServer } from '../http/server.js';

vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    TELEGRAM_BOT_TOKEN: 'mock_token',
    TELEGRAM_OWNER_ID: 123456789,
    TELEGRAM_WEBHOOK_SECRET: 'super_secret_webhook_token',
    APP_URL: 'https://example.com',
    PORT: 0,
  }),
}));

vi.mock('../services/telegramService.js', () => ({
  getTelegramBot: () => ({
    on: vi.fn(),
  }),
  recordTelegramWebhookError: vi.fn(),
  TelegramService: {
    getDiagnosticStatus: vi.fn(),
  },
}));

vi.mock('../services/discordService.js', () => ({
  getDiscordClient: () => ({
    isReady: () => true,
    guilds: { cache: { size: 2 } },
  }),
}));

vi.mock('../database/client.js', () => ({
  testDatabaseConnection: async () => true,
}));

vi.mock('grammy', () => ({
  Bot: class {
    on() {}
  },
  webhookCallback: () => async (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  },
}));

describe('HTTP Server & Telegram Webhook Validation', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    server = createHttpServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 OK', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /ready verifies database and discord connections', async () => {
    const res = await fetch(`http://localhost:${port}/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
    expect(body.databaseConnected).toBe(true);
    expect(body.discordConnected).toBe(true);
  });

  it('12. Telegram webhook secret validation rejects invalid header', async () => {
    const res = await fetch(`http://localhost:${port}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong_secret',
      },
      body: JSON.stringify({ update_id: 100 }),
    });

    expect(res.status).toBe(401);
  });

  it('12. Telegram webhook secret validation accepts valid header', async () => {
    const res = await fetch(`http://localhost:${port}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'super_secret_webhook_token',
      },
      body: JSON.stringify({ update_id: 100 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('13. Telegram webhook malformed request handling', async () => {
    const res = await fetch(`http://localhost:${port}/api/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid-json',
    });

    expect(res.status).toBe(401); // Secret missing
  });
});
