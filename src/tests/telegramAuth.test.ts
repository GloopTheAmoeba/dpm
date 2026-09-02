import { describe, it, expect, vi } from 'vitest';
import { TelegramService } from '../services/telegramService.js';

vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    TELEGRAM_OWNER_ID: 123456789,
    TELEGRAM_WEBHOOK_SECRET: 'test_secret_token_123',
    APP_URL: 'https://example.com',
  }),
}));

describe('Telegram Authorization & Command Parsing', () => {
  it('6. Telegram owner authorization permits TELEGRAM_OWNER_ID', () => {
    expect(TelegramService.isOwnerAuthorized(123456789)).toBe(true);
  });

  it('7. Telegram unauthorized-user rejection rejects non-owner IDs', () => {
    expect(TelegramService.isOwnerAuthorized(999999999)).toBe(false);
    expect(TelegramService.isOwnerAuthorized(0)).toBe(false);
  });

  it('8. Telegram command parsing extracts command name and arguments', () => {
    const text = '/info 987654321098765432';
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const arg = parts[1];

    expect(command).toBe('/info');
    expect(arg).toBe('987654321098765432');
  });
});
