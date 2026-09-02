import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseRepository } from '../database/repository.js';

// Mock getPool to simulate isolated database queries
const mockQuery = vi.fn();
vi.mock('../database/client.js', () => ({
  getPool: () => ({
    query: mockQuery,
  }),
}));

describe('Database & Guild Configuration Isolation', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('9. Discord guild configuration isolation - Guild A config does not affect Guild B', async () => {
    // Guild A setup
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          guildId: 'guild_A',
          guildName: 'Guild A',
          notificationChannelId: 'channel_111',
          notificationsEnabled: true,
        },
      ],
    });

    const guildA = await DatabaseRepository.setGuildNotificationChannel('guild_A', 'Guild A', 'channel_111', true);
    expect(guildA.guildId).toBe('guild_A');
    expect(guildA.notificationChannelId).toBe('channel_111');

    // Guild B query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          guildId: 'guild_B',
          guildName: 'Guild B',
          notificationChannelId: 'channel_222',
          notificationsEnabled: false,
        },
      ],
    });

    const guildB = await DatabaseRepository.getGuild('guild_B');
    expect(guildB?.guildId).toBe('guild_B');
    expect(guildB?.notificationChannelId).toBe('channel_222');
    expect(guildB?.notificationsEnabled).toBe(false);
  });

  it('10. Duplicate join-event protection (idempotency)', async () => {
    // First insertion succeeds (1 row inserted)
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const firstAttempt = await DatabaseRepository.logEventIdempotent({
      eventId: 'join_123_456_1000',
      eventType: 'GUILD_MEMBER_ADD',
      guildId: '123',
      discordUserId: '456',
    });
    expect(firstAttempt).toBe(true);

    // Duplicate insertion ignored (0 rows inserted due to ON CONFLICT DO NOTHING)
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const secondAttempt = await DatabaseRepository.logEventIdempotent({
      eventId: 'join_123_456_1000',
      eventType: 'GUILD_MEMBER_ADD',
      guildId: '123',
      discordUserId: '456',
    });
    expect(secondAttempt).toBe(false);
  });

  it('11. Database constraint handling', async () => {
    mockQuery.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "uq_guild_member"'));

    await expect(
      DatabaseRepository.upsertMember({
        guildId: '123',
        discordUserId: '456',
        username: 'user',
        displayName: 'User',
        globalName: null,
        nickname: null,
        avatarUrl: null,
        isBot: false,
        accountCreatedAt: new Date(),
        lastJoinedAt: new Date(),
      })
    ).rejects.toThrow('unique constraint');
  });
});
