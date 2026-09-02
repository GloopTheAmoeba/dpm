import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseRepository } from '../../database/repository.js';
import { calculateAccountAge } from '../../utils/accountAge.js';
import { formatExactUtc } from '../../utils/date.js';
import { testDatabaseConnection } from '../../database/client.js';
import { DiscordMemberInfo } from '../../types/index.js';

export const discordSlashCommands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure member join notification channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to send join notifications in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('enabled')
        .setDescription('Enable or disable join notifications')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('View current guild notification configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('View bot operational status'),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Lookup information for a Discord user ID')
    .addStringOption((option) =>
      option
        .setName('user_id')
        .setDescription('The Discord user ID to lookup')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help and command list'),
];

export async function handleDiscordSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName, guild } = interaction;

  if (!guild) {
    await interaction.reply({ content: '❌ Commands can only be used within a server.', flags: 64 });
    return;
  }

  switch (commandName) {
    case 'setup': {
      // Check user permissions explicitly on server side
      const memberPermissions = interaction.memberPermissions;
      if (!memberPermissions || (!memberPermissions.has(PermissionFlagsBits.ManageGuild) && !memberPermissions.has(PermissionFlagsBits.Administrator))) {
        await interaction.reply({
          content: '❌ Permission denied. You need `Manage Server` permission to configure notifications.',
          flags: 64,
        });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const enabled = interaction.options.getBoolean('enabled') ?? true;

      // Check bot permissions in target channel
      const me = guild.members.me;
      if (me && 'permissionsFor' in channel) {
        const botPerms = channel.permissionsFor(me);
        if (botPerms && (!botPerms.has(PermissionFlagsBits.SendMessages) || !botPerms.has(PermissionFlagsBits.EmbedLinks))) {
          await interaction.reply({
            content: `⚠️ Warning: The bot lacks \`Send Messages\` or \`Embed Links\` permissions in <#${channel.id}>. Please update channel permissions.`,
            flags: 64,
          });
        }
      }

      await DatabaseRepository.setGuildNotificationChannel(guild.id, guild.name, channel.id, enabled);

      await interaction.reply({
        content: `✅ Notification channel configured successfully!\n• Channel: <#${channel.id}>\n• Notifications: ${enabled ? 'Enabled 🟢' : 'Disabled 🔴'}`,
      });
      break;
    }

    case 'config': {
      const memberPermissions = interaction.memberPermissions;
      if (!memberPermissions || (!memberPermissions.has(PermissionFlagsBits.ManageGuild) && !memberPermissions.has(PermissionFlagsBits.Administrator))) {
        await interaction.reply({
          content: '❌ Permission denied. You need `Manage Server` permission to view config.',
          flags: 64,
        });
        return;
      }

      const config = await DatabaseRepository.getGuild(guild.id);
      if (!config || !config.notificationChannelId) {
        await interaction.reply({
          content: '⚙️ No notification channel is currently set for this server. Use `/setup` to configure one.',
        });
        return;
      }

      await interaction.reply({
        content: `⚙️ **Guild Configuration for ${guild.name}**\n• Channel: <#${config.notificationChannelId}>\n• Notifications: ${config.notificationsEnabled ? 'Enabled 🟢' : 'Disabled 🔴'}`,
      });
      break;
    }

    case 'status': {
      const dbOk = await testDatabaseConnection();
      const connectedGuilds = interaction.client.guilds.cache.size;

      const embed = new EmbedBuilder()
        .setTitle('📊 Bot System Status')
        .setColor(dbOk ? 0x57f287 : 0xed4245)
        .addFields(
          { name: 'Discord Gateway', value: 'Connected 🟢', inline: true },
          { name: 'Database', value: dbOk ? 'Connected 🟢' : 'Disconnected 🔴', inline: true },
          { name: 'Connected Guilds', value: String(connectedGuilds), inline: true },
          { name: 'Uptime', value: `${(process.uptime() / 60).toFixed(1)} minutes`, inline: true },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      break;
    }

    case 'info': {
      const targetUserId = interaction.options.getString('user_id', true).trim();

      if (!/^\d{17,20}$/.test(targetUserId)) {
        await interaction.reply({
          content: '❌ Invalid Discord user ID format. Discord user IDs must be 17-20 digits.',
          flags: 64,
        });
        return;
      }

      // Try fetching member directly from guild first if present
      const fetchedMember = await guild.members.fetch(targetUserId).catch(() => null);
      let memberInfo: DiscordMemberInfo | null = fetchedMember ? {
        discordUserId: fetchedMember.user.id,
        username: fetchedMember.user.username,
        displayName: fetchedMember.displayName || fetchedMember.user.displayName || fetchedMember.user.username,
        globalName: fetchedMember.user.globalName || null,
        nickname: fetchedMember.nickname || null,
        avatarUrl: fetchedMember.displayAvatarURL({ extension: 'png', size: 256 }) || fetchedMember.user.displayAvatarURL({ extension: 'png', size: 256 }) || null,
        isBot: fetchedMember.user.bot,
        accountCreatedAt: fetchedMember.user.createdAt,
        lastJoinedAt: fetchedMember.joinedAt || new Date(),
        guildId: guild.id,
        guildName: guild.name,
      } : null;

      // Fallback to database lookup if not currently in guild
      if (!memberInfo) {
        memberInfo = await DatabaseRepository.getMember(guild.id, targetUserId);
      }
      if (!memberInfo) {
        memberInfo = await DatabaseRepository.getMemberByDiscordId(targetUserId);
      }

      if (!memberInfo) {
        await interaction.reply({
          content: `❌ No stored or live member information found for user ID \`${targetUserId}\`.`,
          flags: 64,
        });
        return;
      }

      const accountAge = calculateAccountAge(memberInfo.accountCreatedAt, memberInfo.lastJoinedAt);
      const createdUtc = formatExactUtc(memberInfo.accountCreatedAt);
      const joinedUtc = formatExactUtc(memberInfo.lastJoinedAt);

      const embed = new EmbedBuilder()
        .setTitle(`👤 Discord User Info: ${memberInfo.username}`)
        .setColor(0x5865f2)
        .addFields(
          { name: 'Username', value: memberInfo.username, inline: true },
          { name: 'Display Name', value: memberInfo.displayName, inline: true },
          { name: 'Global Name', value: memberInfo.globalName || 'N/A', inline: true },
          { name: 'Server Nickname', value: memberInfo.nickname || 'None', inline: true },
          { name: 'Discord ID', value: memberInfo.discordUserId, inline: true },
          { name: 'Mention', value: `<@${memberInfo.discordUserId}>`, inline: true },
          { name: 'Account Type', value: memberInfo.isBot ? 'Bot 🤖' : 'User 👤', inline: true },
          { name: 'Account Created', value: createdUtc, inline: false },
          { name: 'Account Age', value: accountAge.formatted, inline: false },
          { name: 'Joined Server', value: joinedUtc, inline: false },
          { name: 'Server', value: memberInfo.guildName || memberInfo.guildId, inline: true },
        );

      if (memberInfo.avatarUrl) {
        embed.setThumbnail(memberInfo.avatarUrl);
      }

      await interaction.reply({ embeds: [embed] });
      break;
    }

    case 'help': {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Discord Bot Commands')
        .setColor(0x5865f2)
        .setDescription(
          '`/setup channel:<#channel> [enabled:true/false]` - Configure join notification channel (Requires Manage Server)\n' +
            '`/config` - View current notification settings (Requires Manage Server)\n' +
            '`/status` - View bot operational status\n' +
            '`/info user_id:<Discord User ID>` - Lookup member details\n' +
            '`/help` - Show command help'
        );

      await interaction.reply({ embeds: [embed] });
      break;
    }

    default:
      await interaction.reply({ content: 'Unknown command.', flags: 64 });
      break;
  }
}
