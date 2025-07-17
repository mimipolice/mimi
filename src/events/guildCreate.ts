import { Guild, TextChannel, ChannelType, PermissionsBitField } from 'discord.js';

export const name = 'guildCreate';

export async function execute(guild: Guild) {
  const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!).has(PermissionsBitField.Flags.SendMessages)) as TextChannel;

  if (channel) {
    await channel.send({
      content: `
Thanks for inviting me to your server!

To get started, please use the \`/config set\` command to configure the ticket system.
You will need to provide a staff role, a ticket category, a log channel, and a panel channel.

Once you have configured the bot, you can use the \`/ticketpanel setup\` command to create the ticket panel.
      `,
    });
  }
}
