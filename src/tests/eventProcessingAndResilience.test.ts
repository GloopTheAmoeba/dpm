import { describe, it, expect, vi } from 'vitest';
import { MemberService } from '../services/memberService.js';
import { TelegramService } from '../services/telegramService.js';
import { DatabaseRepository } from '../database/repository.js';
import { GuildMember } from 'discord.js';
import { DiscordMemberInfo } from '../types/index.js';

describe('Discord Event Processing & Telegram Resilience', () => {
  it('14. Discord event processing & 15. Telegram failure does not crash Discord processing', async () => {
    // Mock Database Repository functions
    vi.spyOn(DatabaseRepository, 'logEventIdempotent').mockResolvedValue(true);
    vi.spyOn(DatabaseRepository, 'upsertMember').mockResolvedValue({} as DiscordMemberInfo);
    vi.spyOn(DatabaseRepository, 'getGuild').mockResolvedValue({
      guildId: 'guild_123',
      guildName: 'Test Guild',
      notificationChannelId: 'channel_456',
      notificationsEnabled: true,
    });

    // Mock Telegram notification to simulate failure
    const telegramSpy = vi
      .spyOn(TelegramService, 'notifyOwnerOfJoin')
      .mockRejectedValue(new Error('Telegram API connection timeout'));

    // Mock Discord GuildMember
    const mockSend = vi.fn().mockResolvedValue({});
    const mockTextChannel = {
      isTextBased: () => true,
      permissionsFor: () => ({
        has: () => true,
      }),
      send: mockSend,
      id: 'channel_456',
    };

    const mockMember = {
      id: 'user_789',
      displayName: 'NewMember',
      nickname: null,
      joinedAt: new Date(),
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
      user: {
        id: 'user_789',
        tag: 'NewMember#0001',
        username: 'newmember',
        displayName: 'NewMember',
        globalName: null,
        bot: false,
        createdAt: new Date('2021-01-01T00:00:00Z'),
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
      },
      guild: {
        id: 'guild_123',
        name: 'Test Guild',
        memberCount: 50,
        channels: {
          fetch: async () => mockTextChannel,
        },
        members: {
          me: { id: 'bot_id' },
        },
      },
      roles: {
        cache: new Map(),
      },
    } as unknown as GuildMember;

    // Execute event processing
    const result = await MemberService.processMemberJoin(mockMember);

    // Assertions:
    // 1. Process returned true indicating success
    expect(result).toBe(true);

    // 2. Discord notification was sent
    expect(mockSend).toHaveBeenCalledOnce();

    // 3. Telegram notify attempted and failed, but did not crash or abort Discord processing
    expect(telegramSpy).toHaveBeenCalledOnce();
  });
});
