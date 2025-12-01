import { Guild, TextChannel, ChannelType, PermissionsBitField } from 'discord.js';

export const name = 'guildCreate';

export async function execute(guild: Guild) {
  const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!).has(PermissionsBitField.Flags.SendMessages)) as TextChannel;

  if (channel) {
    await channel.send({
      content: `<:sc:1444897142509670481> **感謝邀請我！**

<:pck:1444901376139202662> **開始使用**
使用 </config set:1397608562225709100> 來設定客服單系統。

<:notice:1444897740566958111> **必要設定**
• 客服身分組
• 客服單類別
• 日誌頻道
• 面板頻道

<:bck:1444901131825315850> **最後一步**
執行 </panel setup:1397608562678698107> 來建立客服單面板。

———

<:sc:1444897142509670481> **Thanks for inviting me!**

<:pck:1444901376139202662> **Getting Started**
Use </config set:1397608562225709100> to configure the ticket system.

<:notice:1444897740566958111> **Required Settings**
• Staff role
• Ticket category
• Log channel
• Panel channel

<:bck:1444901131825315850> **Final Step**
Run </panel setup:1397608562678698107> to create the ticket panel.`,
    });
  }
}
