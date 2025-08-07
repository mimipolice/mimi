import {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Locale,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "purge") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.editReply({
          content: t.subcommands.purge.responses.no_permission,
        });
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

    const user = interaction.options.getUser(
      t.subcommands.add.options.user.name
    );
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
