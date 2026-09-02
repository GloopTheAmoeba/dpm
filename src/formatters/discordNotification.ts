import { EmbedBuilder } from 'discord.js';
import { DiscordMemberInfo } from '../types/index.js';
import { calculateAccountAge } from '../utils/accountAge.js';
import { formatExactUtc } from '../utils/date.js';

export function buildDiscordJoinEmbed(memberInfo: DiscordMemberInfo): EmbedBuilder {
  const accountAge = calculateAccountAge(memberInfo.accountCreatedAt, memberInfo.lastJoinedAt);
  const createdUtc = formatExactUtc(memberInfo.accountCreatedAt);
  const joinedUtc = formatExactUtc(memberInfo.lastJoinedAt);

  const embed = new EmbedBuilder()
    .setTitle('🎉 New Member')
    .setColor(0x5865f2)
    .setTimestamp(new Date(memberInfo.lastJoinedAt))
    .addFields(
      { name: 'Username', value: memberInfo.username || 'N/A', inline: true },
      { name: 'Display Name', value: memberInfo.displayName || 'N/A', inline: true },
      { name: 'Global Name', value: memberInfo.globalName || 'N/A', inline: true },
      { name: 'Server Nickname', value: memberInfo.nickname || 'None', inline: true },
      { name: 'Discord ID', value: memberInfo.discordUserId, inline: true },
      { name: 'Mention', value: `<@${memberInfo.discordUserId}>`, inline: true },
      { name: 'Account Type', value: memberInfo.isBot ? 'Bot 🤖' : 'User 👤', inline: true },
      { name: 'Account Created', value: createdUtc, inline: false },
      { name: 'Account Age', value: accountAge.formatted, inline: false },
      { name: 'Joined Server', value: joinedUtc, inline: false },
      { name: 'Server', value: memberInfo.guildName || memberInfo.guildId, inline: true },
      { name: 'Server ID', value: memberInfo.guildId, inline: true },
      { name: 'Members Now', value: memberInfo.memberCount ? String(memberInfo.memberCount) : 'Unknown', inline: true },
    );

  if (memberInfo.avatarUrl) {
    embed.setThumbnail(memberInfo.avatarUrl);
  }

  return embed;
}
