import { DiscordMemberInfo } from '../types/index.js';
import { calculateAccountAge } from '../utils/accountAge.js';
import { formatExactUtc } from '../utils/date.js';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildTelegramJoinNotification(memberInfo: DiscordMemberInfo): string {
  const accountAge = calculateAccountAge(memberInfo.accountCreatedAt, memberInfo.lastJoinedAt);
  const createdUtc = formatExactUtc(memberInfo.accountCreatedAt);
  const joinedUtc = formatExactUtc(memberInfo.lastJoinedAt);

  const usernameEsc = escapeHtml(memberInfo.username || 'N/A');
  const displayNameEsc = escapeHtml(memberInfo.displayName || 'N/A');
  const globalNameEsc = memberInfo.globalName ? escapeHtml(memberInfo.globalName) : 'N/A';
  const nicknameEsc = memberInfo.nickname ? escapeHtml(memberInfo.nickname) : 'None';
  const guildNameEsc = memberInfo.guildName ? escapeHtml(memberInfo.guildName) : memberInfo.guildId;

  return [
    `<b>🎉 New Discord Guild Member</b>`,
    ``,
    `<b>Server:</b> ${guildNameEsc} (<code>${memberInfo.guildId}</code>)`,
    `<b>Members Now:</b> ${memberInfo.memberCount ?? 'Unknown'}`,
    ``,
    `<b>User Information:</b>`,
    `• <b>Username:</b> ${usernameEsc}`,
    `• <b>Display Name:</b> ${displayNameEsc}`,
    `• <b>Global Name:</b> ${globalNameEsc}`,
    `• <b>Nickname:</b> ${nicknameEsc}`,
    `• <b>Discord ID:</b> <code>${memberInfo.discordUserId}</code>`,
    `• <b>Account Type:</b> ${memberInfo.isBot ? 'Bot 🤖' : 'User 👤'}`,
    `• <b>Account Created:</b> ${createdUtc}`,
    `• <b>Account Age:</b> ${accountAge.formatted}`,
    `• <b>Joined Server:</b> ${joinedUtc}`,
  ].join('\n');
}
