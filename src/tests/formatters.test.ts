import { describe, it, expect } from 'vitest';
import { buildDiscordJoinEmbed } from '../formatters/discordNotification.js';
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

  it('4. Discord member notification formatting', () => {
    const embed = buildDiscordJoinEmbed(sampleMember);
    const data = embed.toJSON();

    expect(data.title).toBe('🎉 New Member');
    expect(data.fields).toBeDefined();

    const usernameField = data.fields?.find((f) => f.name === 'Username');
    expect(usernameField?.value).toBe('john_doe');

    const mentionField = data.fields?.find((f) => f.name === 'Mention');
    expect(mentionField?.value).toBe('<@987654321098765432>');

    expect(data.thumbnail?.url).toBe('https://cdn.discordapp.com/avatars/123/abc.png');
  });

  it('5. Missing optional member fields handled gracefully in Discord and Telegram formatters', () => {
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

    const discordEmbed = buildDiscordJoinEmbed(minimalMember).toJSON();
    expect(discordEmbed.thumbnail).toBeUndefined();

    const globalField = discordEmbed.fields?.find((f) => f.name === 'Global Name');
    expect(globalField?.value).toBe('N/A');

    const nickField = discordEmbed.fields?.find((f) => f.name === 'Server Nickname');
    expect(nickField?.value).toBe('None');

    const telegramText = buildTelegramJoinNotification(minimalMember);
    expect(telegramText).toContain('• <b>Global Name:</b> N/A');
    expect(telegramText).toContain('• <b>Nickname:</b> None');
    expect(telegramText).toContain('<b>Members Now:</b> Unknown');
  });
});
