import { Context } from 'grammy';
import { TelegramService } from '../../services/telegramService.js';
import { DatabaseRepository } from '../../database/repository.js';
import { getDiscordClient } from '../../services/discordService.js';
import { Logger } from '../../utils/logger.js';
import { calculateAccountAge } from '../../utils/accountAge.js';
import { formatExactUtc } from '../../utils/date.js';
import { DiscordMemberInfo } from '../../types/index.js';

async function recordUserAndCheckAuth(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const authorized = TelegramService.isOwnerAuthorized(from.id);

  try {
    await DatabaseRepository.upsertTelegramUser({
      telegramUserId: from.id,
      username: from.username || null,
      firstName: from.first_name || null,
      isAuthorized: authorized,
    });
  } catch (err) {
    Logger.error('Failed to record Telegram user:', (err as Error).message);
  }

  if (!authorized) {
    await ctx.reply('⛔ Unauthorized. This is a private personal bot.');
    return false;
  }

  return true;
}

export async function handleTelegramCommand(
  ctx: Context,
  discordConnected: boolean,
  connectedGuildsCount: number,
  botVersion: string,
): Promise<void> {
  const text = ctx.message?.text?.trim() || '';
  if (!text.startsWith('/')) return;

  const parts = text.split(/\s+/);
  const command = parts[0].split('@')[0].toLowerCase();
  const args = parts.slice(1);

  if (!(await recordUserAndCheckAuth(ctx))) {
    return;
  }

  switch (command) {
    case '/start':
      await ctx.reply(
        '🤖 <b>Welcome to your Personal Discord + Telegram Info Bot!</b>\n\nUse /help to view available commands.',
        { parse_mode: 'HTML' }
      );
      break;

    case '/help':
      await ctx.reply(
        `<b>📋 Available Telegram Commands:</b>\n\n` +
          `• <b>/start</b> - Start the bot\n` +
          `• <b>/help</b> - Show available commands\n` +
          `• <b>/status</b> - Show detailed system status\n` +
          `• <b>/servers</b> - List connected Discord servers\n` +
          `• <b>/info &lt;discord_user_id&gt;</b> - Lookup Discord member details`,
        { parse_mode: 'HTML' }
      );
      break;

    case '/status': {
      const diag = await TelegramService.getDiagnosticStatus(discordConnected, connectedGuildsCount, botVersion);
      const uptimeMin = (diag.status.uptimeSeconds / 60).toFixed(1);

      await ctx.reply(
        `<b>📊 Bot System Status</b>\n\n` +
          `• <b>Discord Gateway:</b> ${diag.status.discordConnected ? 'Connected 🟢' : 'Disconnected 🔴'}\n` +
          `• <b>Telegram Webhook:</b> ${diag.apiAuthWorking ? 'Active 🟢' : 'Error 🔴'}\n` +
          `• <b>Database:</b> ${diag.status.databaseConnected ? 'Connected 🟢' : 'Disconnected 🔴'}\n` +
          `• <b>Connected Discord Guilds:</b> ${diag.status.connectedGuildsCount}\n` +
          `• <b>Tracked Members:</b> ${diag.status.trackedMemberCount}\n` +
          `• <b>Uptime:</b> ${uptimeMin} minutes\n` +
          `• <b>Bot Version:</b> ${diag.status.version}\n` +
          `• <b>Pending Updates:</b> ${diag.pendingUpdateCount}` +
          (diag.lastError ? `\n• <b>Last Webhook Error:</b> <code>${diag.lastError.error}</code>` : ''),
        { parse_mode: 'HTML' }
      );
      break;
    }

    case '/servers': {
      const guilds = await DatabaseRepository.getAllGuilds();
      if (guilds.length === 0) {
        await ctx.reply('No Discord servers stored or connected yet.');
        return;
      }

      const lines = guilds.map((g) => `• <b>${escapeHtml(g.guildName)}</b> (ID: <code>${g.guildId}</code>)`);

      await ctx.reply(`<b>🏰 Connected Discord Servers (${guilds.length}):</b>\n\n${lines.join('\n')}`, {
        parse_mode: 'HTML',
      });
      break;
    }

    case '/info': {
      const targetUserId = args[0]?.trim();
      if (!targetUserId) {
        await ctx.reply('⚠️ Please provide a Discord user ID.\n\nUsage: <code>/info &lt;discord_user_id&gt;</code>', {
          parse_mode: 'HTML',
        });
        return;
      }

      if (!/^\d{17,20}$/.test(targetUserId)) {
        await ctx.reply(
          `❌ Invalid Discord User ID format: <code>${escapeHtml(targetUserId)}</code>.\nDiscord User IDs must be 17 to 20 numeric digits.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      let member: DiscordMemberInfo | null = await DatabaseRepository.getMemberByDiscordId(targetUserId);

      // If not in database or to refresh live info, query Discord API directly if ready
      const discordClient = getDiscordClient();
      if (discordClient.isReady()) {
        try {
          const user = await discordClient.users.fetch(targetUserId).catch(() => null);
          if (user) {
            // Find if user is in any connected guild
            let matchedGuildName = 'Global Discord User';
            let matchedGuildId = member?.guildId || discordClient.guilds.cache.first()?.id || '0';
            let memberCount: number | undefined = undefined;
            let nickname: string | null = null;
            let joinedAt = member?.lastJoinedAt || new Date();

            for (const guild of discordClient.guilds.cache.values()) {
              const fetchedMember = await guild.members.fetch(user.id).catch(() => null);
              if (fetchedMember) {
                matchedGuildName = guild.name;
                matchedGuildId = guild.id;
                memberCount = guild.memberCount;
                nickname = fetchedMember.nickname || null;
                joinedAt = fetchedMember.joinedAt || joinedAt;
                break;
              }
            }

            const liveMemberInfo: DiscordMemberInfo = {
              guildId: matchedGuildId,
              guildName: matchedGuildName,
              discordUserId: user.id,
              username: user.username,
              displayName: user.displayName || user.username,
              globalName: user.globalName || null,
              nickname: nickname,
              avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }) || null,
              isBot: user.bot,
              accountCreatedAt: user.createdAt,
              lastJoinedAt: joinedAt,
              memberCount: memberCount,
            };

            await DatabaseRepository.upsertMember(liveMemberInfo).catch(() => null);
            member = liveMemberInfo;
          }
        } catch (err) {
          Logger.warn(`Discord user fetch error for ${targetUserId}:`, (err as Error).message);
        }
      }

      if (!member) {
        await ctx.reply(
          `❌ No Discord user or stored member found for ID: <code>${escapeHtml(targetUserId)}</code>.\n\nPlease verify the user ID is correct and that the user exists on Discord.`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const accountAge = calculateAccountAge(member.accountCreatedAt, member.lastJoinedAt);
      const createdUtc = formatExactUtc(member.accountCreatedAt);
      const joinedUtc = formatExactUtc(member.lastJoinedAt);

      await ctx.reply(
        `<b>👤 Discord Member Info</b>\n\n` +
          `• <b>Username:</b> ${escapeHtml(member.username)}\n` +
          `• <b>Display Name:</b> ${escapeHtml(member.displayName)}\n` +
          `• <b>Global Name:</b> ${member.globalName ? escapeHtml(member.globalName) : 'N/A'}\n` +
          `• <b>Nickname:</b> ${member.nickname ? escapeHtml(member.nickname) : 'None'}\n` +
          `• <b>Discord ID:</b> <code>${member.discordUserId}</code>\n` +
          `• <b>Account Type:</b> ${member.isBot ? 'Bot 🤖' : 'User 👤'}\n` +
          `• <b>Account Created:</b> ${createdUtc}\n` +
          `• <b>Account Age:</b> ${accountAge.formatted}\n` +
          `• <b>Server:</b> ${escapeHtml(member.guildName || member.guildId)}\n` +
          `• <b>Server ID:</b> <code>${member.guildId}</code>\n` +
          `• <b>Joined Server:</b> ${joinedUtc}`,
        { parse_mode: 'HTML' }
      );
      break;
    }

    default:
      await ctx.reply('Unknown command. Use /help to see available commands.');
      break;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
