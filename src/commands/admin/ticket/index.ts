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

const translations = getLocalizations("ticket");

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].description,
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.add.name)
        .setDescription(translations["en-US"].subcommands.add.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.description,
        })
        .addUserOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.user.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.user.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.user.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.user.description,
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.remove.name)
        .setDescription(translations["en-US"].subcommands.remove.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.remove.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.remove.description,
        })
        .addUserOption((option) =>
          option
            .setName(translations["en-US"].subcommands.remove.options.user.name)
            .setDescription(
              translations["en-US"].subcommands.remove.options.user.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.user.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.user
                  .description,
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.purge.name)
        .setDescription(translations["en-US"].subcommands.purge.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.purge.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.purge.description,
        })
    ),
  async execute(
    interaction,
    client,
    { ticketManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

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
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
      });
      await interaction.editReply({
        content: t.subcommands.add.responses.success.replace(
          "{{userTag}}",
          user.tag
        ),
      });
    } else if (subcommand === "remove") {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
      });
      await interaction.editReply({
        content: t.subcommands.remove.responses.success.replace(
          "{{userTag}}",
          user.tag
        ),
      });
    }
  },
};
