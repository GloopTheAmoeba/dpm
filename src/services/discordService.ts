import { Client, GatewayIntentBits, REST, Routes, Events, GuildMember, Guild } from 'discord.js';
import { getConfig } from '../config/index.js';
import { Logger } from '../utils/logger.js';
import { discordSlashCommands, handleDiscordSlashCommand } from '../commands/discord/index.js';
import { MemberService } from './memberService.js';
import { DatabaseRepository } from '../database/repository.js';

let discordClient: Client | null = null;

export function getDiscordClient(): Client {
  if (!discordClient) {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
      ],
    });
  }
  return discordClient;
}

export class DiscordService {
  /**
   * Register slash commands globally with Discord REST API.
   */
  static async registerSlashCommands(): Promise<void> {
    try {
      const config = getConfig();
      const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);

      Logger.info('Registering Discord slash commands...');
      const commandData = discordSlashCommands.map((cmd) => cmd.toJSON());

      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
        body: commandData,
      });

      Logger.info('Successfully registered global Discord slash commands.');
    } catch (err) {
      Logger.error('Failed to register Discord slash commands:', (err as Error).message);
    }
  }

  /**
   * Start Discord Gateway connection and attach event handlers.
   */
  static async startBot(): Promise<Client> {
    const config = getConfig();
    const client = getDiscordClient();

    client.once(Events.ClientReady, async (c) => {
      Logger.info(`Discord Bot logged in as ${c.user.tag}`);

      // Sync connected guilds to DB
      for (const guild of c.guilds.cache.values()) {
        await DatabaseRepository.upsertGuild({
          guildId: guild.id,
          guildName: guild.name,
          notificationChannelId: null,
          notificationsEnabled: true,
        }).catch((err) => Logger.error(`Failed to sync guild ${guild.id}:`, err.message));
      }

      // Register slash commands asynchronously
      await this.registerSlashCommands();
    });

    client.on(Events.GuildCreate, async (guild: Guild) => {
      Logger.info(`Bot joined guild: ${guild.name} (${guild.id})`);
      await DatabaseRepository.upsertGuild({
        guildId: guild.id,
        guildName: guild.name,
        notificationChannelId: null,
        notificationsEnabled: true,
      }).catch((err) => Logger.error(`Failed to sync newly joined guild ${guild.id}:`, err.message));
    });

    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      Logger.info(`GUILD_MEMBER_ADD detected: ${member.user.tag} in ${member.guild.name} (${member.guild.id})`);
      await MemberService.processMemberJoin(member).catch((err) => {
        Logger.error(`Error processing GUILD_MEMBER_ADD for ${member.id}:`, err.message);
      });
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      try {
        await handleDiscordSlashCommand(interaction);
      } catch (err) {
        Logger.error('Error handling Discord slash command:', (err as Error).message);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An internal error occurred while processing this command.',
            flags: 64,
          }).catch(() => null);
        }
      }
    });

    client.on(Events.Error, (err) => {
      Logger.error('Discord Gateway error:', err.message);
    });

    client.on('shardDisconnect', (event) => {
      Logger.warn(`Discord Gateway disconnected (code ${event.code}). Will attempt reconnect.`);
    });

    client.on('shardReconnecting', () => {
      Logger.info('Discord Gateway reconnecting...');
    });

    await client.login(config.DISCORD_BOT_TOKEN);
    return client;
  }
}
