import { describe, it, expect } from 'vitest';
import { buildTelegramJoinNotification } from '../formatters/telegramNotification.js';
import { DiscordMemberInfo } from '../types/index.js';

describe('Notification Formatters', () => {
  const sampleMember: DiscordMemberInfo = {
    guildId: '123456789012345678',
    guildName: 'Test Guild',
    discordUserId: '987654321098765432',
    username: 'john_doe',
    displayName: 'John Doe',
    globalName: 'John Global',
    nickname: 'Johnny',
    avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc.png',
    isBot: false,
    accountCreatedAt: new Date('2020-01-01T00:00:00Z'),
    lastJoinedAt: new Date('2025-01-01T00:00:00Z'),
    memberCount: 150,
  };

  it('4. Telegram member notification formatting', () => {
    const text = buildTelegramJoinNotification(sampleMember);
    expect(text).toContain('🎉 New Discord Guild Member');
    expect(text).toContain('john_doe');
    expect(text).toContain('987654321098765432');
    expect(text).toContain('Test Guild');
    expect(text).toContain('Members Now:</b> 150');
  });

  it('5. Missing optional member fields handled gracefully in Telegram formatter', () => {
    const minimalMember: DiscordMemberInfo = {
      guildId: '123456789012345678',
      discordUserId: '987654321098765432',
      username: 'minimal_user',
      displayName: 'minimal_user',
      globalName: null,
      nickname: null,
      avatarUrl: null,
      isBot: false,
      accountCreatedAt: new Date('2022-06-15T10:00:00Z'),
      lastJoinedAt: new Date('2025-02-01T12:00:00Z'),
    };

    const telegramText = buildTelegramJoinNotification(minimalMember);
    expect(telegramText).toContain('• <b>Global Name:</b> N/A');
    expect(telegramText).toContain('• <b>Nickname:</b> None');
    expect(telegramText).toContain('<b>Members Now:</b> Unknown');
  });
});
