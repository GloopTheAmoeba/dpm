import { Client, GatewayIntentBits, Events, GuildMember, Guild } from 'discord.js';
import { getConfig } from '../config/index.js';
import { Logger } from '../utils/logger.js';
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
        }).catch((err) => Logger.error(`Failed to sync guild ${guild.id}:`, err.message));
      }
    });

    client.on(Events.GuildCreate, async (guild: Guild) => {
      Logger.info(`Bot joined guild: ${guild.name} (${guild.id})`);
      await DatabaseRepository.upsertGuild({
        guildId: guild.id,
        guildName: guild.name,
      }).catch((err) => Logger.error(`Failed to sync newly joined guild ${guild.id}:`, err.message));
    });

    client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      Logger.info(`GUILD_MEMBER_ADD detected: ${member.user.tag} in ${member.guild.name} (${member.guild.id})`);
      await MemberService.processMemberJoin(member).catch((err) => {
        Logger.error(`Error processing GUILD_MEMBER_ADD for ${member.id}:`, err.message);
      });
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
