import { getConfig } from './config/index.js';
import { runMigrations } from './database/migrator.js';
import { closePool, testDatabaseConnection } from './database/client.js';
import { DiscordService, getDiscordClient } from './services/discordService.js';
import { TelegramService } from './services/telegramService.js';
import { startHttpServer, stopHttpServer } from './http/server.js';
import { Logger } from './utils/logger.js';

async function main() {
  Logger.info('Starting Discord + Telegram Information Bot...');

  // 1. Validate configuration
  const config = getConfig();
  Logger.info(`Environment loaded: NODE_ENV=${config.NODE_ENV}, APP_URL=${config.APP_URL}`);

  // 2. Connect to database & run migrations
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    Logger.error('Failed to connect to PostgreSQL database. Exiting.');
    process.exit(1);
  }
  Logger.info('Database connection verified. Running migrations...');
  await runMigrations();

  // 3. Setup Telegram bot, commands, and webhook
  Logger.info('Setting up Telegram service...');
  await TelegramService.registerCommands();
  await TelegramService.setupWebhook();

  // 4. Start HTTP Server
  Logger.info('Starting HTTP server...');
  await startHttpServer();

  // 5. Connect Discord Gateway
  Logger.info('Connecting to Discord Gateway...');
  await DiscordService.startBot();

  Logger.info('Bot startup complete and fully operational!');
}

async function shutdown(signal: string) {
  Logger.info(`Received ${signal}. Shutting down gracefully...`);

  try {
    const discordClient = getDiscordClient();
    if (discordClient) {
      Logger.info('Destroying Discord Gateway client...');
      await discordClient.destroy();
    }

    Logger.info('Stopping HTTP server...');
    await stopHttpServer();

    Logger.info('Closing PostgreSQL database connection pool...');
    await closePool();

    Logger.info('Shutdown complete.');
    process.exit(0);
  } catch (err) {
    Logger.error('Error during shutdown:', (err as Error).message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled Promise Rejection:', reason instanceof Error ? reason.message : String(reason));
});

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception:', err.message);
});

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    Logger.error('Fatal error during startup:', err.message);
    process.exit(1);
  });
}
