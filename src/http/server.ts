import http, { IncomingMessage, ServerResponse } from 'node:http';
import { webhookCallback } from 'grammy';
import { getConfig } from '../config/index.js';
import { getTelegramBot, recordTelegramWebhookError } from '../services/telegramService.js';
import { testDatabaseConnection } from '../database/client.js';
import { getDiscordClient } from '../services/discordService.js';
import { handleTelegramCommand } from '../commands/telegram/index.js';
import { Logger } from '../utils/logger.js';

let server: http.Server | null = null;
const BOT_VERSION = '1.0.0';

export function createHttpServer(): http.Server {
  const config = getConfig();
  const bot = getTelegramBot();

  // Attach command handler to Grammy bot instance
  bot.on('message:text', async (ctx) => {
    const discordClient = getDiscordClient();
    const discordConnected = discordClient.isReady();
    const connectedGuildsCount = discordClient.guilds.cache.size;

    await handleTelegramCommand(ctx, discordConnected, connectedGuildsCount, BOT_VERSION);
  });

  const grammyHandler = webhookCallback(bot, 'http', {
    secretToken: config.TELEGRAM_WEBHOOK_SECRET,
    onTimeout: 'throw',
  });

  server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const method = req.method?.toUpperCase();

    // GET /health - Simple alive check
    if (method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // GET /ready - Verification of required dependencies
    if (method === 'GET' && url.pathname === '/ready') {
      const dbConnected = await testDatabaseConnection();
      const discordClient = getDiscordClient();
      const discordConnected = discordClient.isReady();

      const isReady = dbConnected && discordConnected;

      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: isReady ? 'ready' : 'degraded',
          databaseConnected: dbConnected,
          discordConnected: discordConnected,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // POST /api/telegram/webhook - Telegram webhook endpoint
    if (method === 'POST' && url.pathname === '/api/telegram/webhook') {
      // Validate Telegram secret token header
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      if (!secretHeader || secretHeader !== config.TELEGRAM_WEBHOOK_SECRET) {
        Logger.warn('Unauthorized Telegram webhook attempt (invalid or missing secret token header)');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        await grammyHandler(req, res);
      } catch (err) {
        Logger.error('Error handling Telegram webhook request:', (err as Error).message);
        recordTelegramWebhookError(err as Error);
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        }
      }
      return;
    }

    // Default 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

export async function startHttpServer(): Promise<http.Server> {
  const config = getConfig();
  const srv = createHttpServer();

  return new Promise((resolve) => {
    srv.listen(config.PORT, () => {
      Logger.info(`HTTP server listening on port ${config.PORT}`);
      resolve(srv);
    });
  });
}

export async function stopHttpServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
    server = null;
  }
}
