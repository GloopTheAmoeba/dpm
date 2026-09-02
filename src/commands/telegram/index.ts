import { Context } from 'grammy';
import { TelegramService } from '../../services/telegramService.js';
import { DatabaseRepository } from '../../database/repository.js';
import { Logger } from '../../utils/logger.js';
import { calculateAccountAge } from '../../utils/accountAge.js';
import { formatExactUtc } from '../../utils/date.js';

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

      const lines = guilds.map((g) => {
        const notifStatus = g.notificationsEnabled && g.notificationChannelId ? `Channel: <code>${g.notificationChannelId}</code>` : 'Disabled / Not Configured';
        return `• <b>${escapeHtml(g.guildName)}</b>\n  ID: <code>${g.guildId}</code>\n  Notifications: ${notifStatus}`;
      });

      await ctx.reply(`<b>🏰 Connected Discord Servers (${guilds.length}):</b>\n\n${lines.join('\n\n')}`, {
        parse_mode: 'HTML',
      });
      break;
    }

    case '/info': {
      const targetUserId = args[0];
      if (!targetUserId) {
        await ctx.reply('⚠️ Please provide a Discord user ID.\nUsage: <code>/info &lt;discord_user_id&gt;</code>', {
          parse_mode: 'HTML',
        });
        return;
      }

      const member = await DatabaseRepository.getMemberByDiscordId(targetUserId);
      if (!member) {
        await ctx.reply(`❌ No stored information found for Discord User ID: <code>${escapeHtml(targetUserId)}</code>`, {
          parse_mode: 'HTML',
        });
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
