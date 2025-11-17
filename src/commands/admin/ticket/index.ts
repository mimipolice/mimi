import {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Locale,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import { createMissingPermissionsReply } from "../../../utils/interactionReply";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage tickets.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "服務單",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "管理服務單。",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a user to the ticket.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "新增成員",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "將使用者新增至此服務單。",
        })
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to add.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "使用者",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要新增的使用者。",
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a user from the ticket.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "移除成員",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "將使用者從此服務單移除。",
        })
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to remove.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "使用者",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要移除的使用者。",
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setDescription("Close the current ticket.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "關閉",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "關閉目前的服務單。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("request-close")
        .setDescription("Request to close the ticket.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "請求關閉",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "請求關閉此服務單。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("purge")
        .setDescription("Purge all tickets.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "清除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "清除所有服務單。",
        })
    ),
  async execute(
    interaction,
    client,
    { ticketManager, localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(localizationManager, "ticket");
    const t = translations[interaction.locale] || translations["en-US"];
    
    // Only defer if not already deferred or replied
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === "close") {
      const channel = interaction.channel;
      
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({
          content: t.subcommands.add.responses.not_ticket,
        });
        return;
      }

      const ticket = await ticketManager.findTicketByChannel(channel.id);

      if (!ticket) {
        await interaction.editReply({
          content: t.subcommands.add.responses.not_ticket,
        });
        return;
      }

      // Show modal for close reason
      const modal = new ModalBuilder()
        .setCustomId('close_ticket_modal')
        .setTitle('Close Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel("Reason for closing (optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
      return;
    }

    if (subcommand === "request-close") {
      const channel = interaction.channel;
      
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({
          content: t.subcommands.add.responses.not_ticket,
        });
        return;
      }

      const ticket = await ticketManager.findTicketByChannel(channel.id);

      if (!ticket) {
        await interaction.editReply({
          content: t.subcommands.add.responses.not_ticket,
        });
        return;
      }

      // Determine who should be notified
      const isOwner = interaction.user.id === ticket.ownerId;
      const targetUserId = isOwner ? ticket.claimedById : ticket.ownerId;

      if (!targetUserId && isOwner) {
        await interaction.editReply({
          content: "❌ No staff member has claimed this ticket yet. You can use `/ticket close` to close it directly.",
        });
        return;
      }

      const targetUser = await client.users.fetch(targetUserId || ticket.ownerId);
      
      const embed = new EmbedBuilder()
        .setTitle("🔔 Close Request")
        .setDescription(
          `${interaction.user} has requested to close this ticket.\n\nClick a button below to respond.`
        )
        .setColor(0xFFA500)
        .setTimestamp();

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_close_request:${interaction.user.id}`)
        .setLabel("Confirm Close")
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_close_request:${interaction.user.id}`)
        .setLabel("Cancel - Still Need Help")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton,
        cancelButton
      );

      await channel.send({
        content: `${targetUser}`,
        embeds: [embed],
        components: [row],
      });

      await interaction.editReply({
        content: "✅ Close request has been sent. Waiting for confirmation...",
      });
      return;
    }
    
    if (subcommand === "purge") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        const replyOptions = createMissingPermissionsReply(
          localizationManager,
          interaction
        );
        await interaction.editReply({ embeds: replyOptions.embeds });
        return;
      }

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_purge:${interaction.user.id}`)
        .setLabel(t.subcommands.purge.responses.confirm_button)
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton
      );

      await interaction.editReply({
        content: t.subcommands.purge.responses.confirmation_prompt,
        components: [row],
      });
      return;
    }

    // Use English option name
    const user = interaction.options.getUser("user");
    const channel = interaction.channel;

    if (!user) {
      await interaction.editReply({
        content: t.subcommands.add.responses.user_not_found,
      });
      return;
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: t.subcommands.add.responses.not_ticket,
      });
      return;
    }

    const ticket = await ticketManager.findTicketByChannel(channel.id);

    if (!ticket) {
      await interaction.editReply({
        content: t.subcommands.add.responses.not_ticket,
      });
      return;
    }

    if (subcommand === "add") {
      await ticketManager.addUser(channel, user);
      await interaction.editReply({
        content: t.subcommands.add.responses.success.replace(
          "{{userTag}}",
          user.tag
        ),
      });
    } else if (subcommand === "remove") {
      await ticketManager.removeUser(channel, user);
      await interaction.editReply({
        content: t.subcommands.remove.responses.success.replace(
          "{{userTag}}",
          user.tag
        ),
      });
    }
  },
};
