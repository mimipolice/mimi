import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  ComponentType,
  PermissionFlagsBits,
  ButtonBuilder,
  GuildMember,
} from "discord.js";
import logger from "../../utils/logger";
import { SelectMenu } from "../../interfaces/SelectMenu";
import { getInteractionLocale } from "../../utils/localeHelper";
import {
  TicketCategory,
  TicketResolution,
  TicketLogMenuAction,
  TicketLogMenuOptions,
} from "../../types/ticket";
import { TicketRepository } from "../../repositories/ticket.repository";
import { findLocalTranscript } from "../../utils/transcript";

/**
 * Ticket Log Menu - Hierarchical select menu for managing closed tickets in log channel
 *
 * Structure:
 * Main Menu → History / Status / Category / Rating
 *   ↳ Each submenu appears BELOW the main menu (showing both levels)
 *   ↳ Selecting from submenu updates the value and returns to main menu only
 *
 * Visual structure when in submenu:
 *   [Main Menu: History ✓]     ← First row shows current selection
 *   [Select a ticket... ▼]     ← Second row shows submenu options
 *
 * customId format: ticket_log_menu:<menu_type>:<ticket_id>
 */
const selectMenu: SelectMenu = {
  name: /^ticket_log_menu:/,
  execute: async function (interaction, services, databases) {
    const locale = getInteractionLocale(interaction);
    const { localizationManager } = services;
    const { ticketDb } = databases;

    const t = (key: string) =>
      localizationManager.get(`global.ticketLogMenu.${key}`, locale) ?? key;

    try {
      // Permission check: User must have staff role or ManageGuild permission
      const member = interaction.member;
      if (!member || !interaction.guildId) {
        await interaction.reply({
          content: t("noPermission"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if user has ManageGuild permission (admin) or staff role
      const settings = await services.settingsManager.getSettings(interaction.guildId);
      const hasAdminPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      const hasStaffRole = settings?.staffRoleId &&
        member instanceof GuildMember &&
        member.roles.cache.has(settings.staffRoleId);

      if (!hasAdminPermission && !hasStaffRole) {
        await interaction.reply({
          content: t("noPermission"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const [, menuType, ticketIdStr] = interaction.customId.split(":");
      const selectedValue = interaction.values[0];

      // Get ticket repository
      const ticketRepo = new TicketRepository(ticketDb);

      // For main menu, we get ticket from log message id
      // For submenus, ticket id is already in customId
      let ticketId: number;

      if (menuType === "main" && !ticketIdStr) {
        // Find ticket by log message id
        const ticket = await ticketRepo.findTicketByLogMessageId(
          interaction.message.id
        );
        if (!ticket) {
          await interaction.reply({
            content: t("ticketNotFound"),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        ticketId = ticket.id;
      } else {
        ticketId = parseInt(ticketIdStr, 10);
        if (isNaN(ticketId)) {
          logger.warn(`Invalid ticketId in customId: ${interaction.customId}`);
          await interaction.reply({
            content: t("ticketNotFound"),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Handle "back" action - return to main menu only (remove submenu)
      if (selectedValue === "back") {
        const mainMenuRow = buildMainMenu(ticketId, t);
        await interaction.update({
          components: [...getExistingComponentsExceptSelectMenu(interaction), mainMenuRow],
        });
        return;
      }

      // Route to appropriate handler based on menu type
      switch (menuType) {
        case "main":
          await handleMainMenu(interaction, ticketId, selectedValue, t, ticketRepo);
          break;
        case "history":
          await handleHistorySelect(interaction, ticketId, selectedValue, t, ticketRepo);
          break;
        case "status":
          await handleStatusSelect(interaction, ticketId, selectedValue, t, ticketRepo);
          break;
        case "category":
          await handleCategorySelect(interaction, ticketId, selectedValue, t, ticketRepo);
          break;
        case "rating":
          await handleRatingSelect(interaction, ticketId, selectedValue, t, ticketRepo);
          break;
        default:
          logger.warn(`Unknown ticket log menu type: ${menuType}`);
      }
    } catch (error) {
      logger.error("Error in ticketLogMenu:", {
        error,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        customId: interaction.customId,
      });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: t("error"),
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        logger.error("Failed to send error message in ticketLogMenu:", replyError);
      }
    }
  },
};

/**
 * Handle main menu selection - show both parent menu (with selection) and submenu
 */
async function handleMainMenu(
  interaction: StringSelectMenuInteraction,
  ticketId: number,
  selectedValue: string,
  t: (key: string) => string,
  ticketRepo: InstanceType<typeof import("../../repositories/ticket.repository").TicketRepository>
) {
  let submenuRow: ActionRowBuilder<StringSelectMenuBuilder>;

  switch (selectedValue) {
    case "history":
      // Fetch user's ticket history
      const ticket = await ticketRepo.findTicketById(ticketId);
      if (!ticket) {
        await interaction.reply({
          content: t("ticketNotFound"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const history = await ticketRepo.findUserTicketHistory(
        ticket.guildId,
        ticket.ownerId,
        25
      );

      if (history.length === 0) {
        await interaction.reply({
          content: t("noHistory"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      submenuRow = buildHistoryMenu(ticketId, history, t);
      break;

    case "status":
      submenuRow = buildStatusMenu(ticketId, t);
      break;

    case "category":
      submenuRow = buildCategoryMenu(ticketId, t);
      break;

    case "rating":
      submenuRow = buildRatingMenu(ticketId, t);
      break;

    default:
      return;
  }

  // Build parent menu with current selection highlighted
  const parentMenuRow = buildMainMenuWithSelection(ticketId, selectedValue, t);

  await interaction.update({
    components: [
      ...getExistingComponentsExceptSelectMenu(interaction),
      parentMenuRow,  // First row: main menu showing current selection
      submenuRow,     // Second row: submenu options
    ],
  });
}

/**
 * Handle history selection - show transcript link with local fallback
 */
async function handleHistorySelect(
  interaction: StringSelectMenuInteraction,
  _currentTicketId: number,
  selectedValue: string,
  t: (key: string) => string,
  ticketRepo: InstanceType<typeof import("../../repositories/ticket.repository").TicketRepository>
) {
  const selectedTicketId = parseInt(selectedValue, 10);

  // Validate selectedTicketId is a valid number
  if (isNaN(selectedTicketId)) {
    logger.warn(`Invalid selectedTicketId in history select: ${selectedValue}`);
    await interaction.reply({
      content: t("ticketNotFound"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const ticket = await ticketRepo.findTicketById(selectedTicketId);

  if (!ticket) {
    await interaction.reply({
      content: t("ticketNotFound"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const closedAt = ticket.closedAt
    ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:f>`
    : t("unknown");

  let content = `**${t("historyDetail")}**\n`;
  content += `${t("ticketId")}: #${ticket.guildTicketId}\n`;
  content += `${t("closedAt")}: ${closedAt}\n`;
  content += `${t("reason")}: ${ticket.closeReason || t("noReason")}\n`;

  // Try to find transcript URL - use stored URL first, fallback to local search
  let transcriptUrl = ticket.transcriptUrl;

  // If no stored URL, or as a fallback option, try to find local transcript
  const localTranscript = await findLocalTranscript(ticket.channelId);

  if (transcriptUrl && localTranscript) {
    // Show both options if we have both
    content += `\n[${t("viewTranscript")}](${transcriptUrl})`;
    if (transcriptUrl !== localTranscript) {
      content += ` | [${t("viewTranscriptLocal")}](${localTranscript})`;
    }
  } else if (transcriptUrl) {
    content += `\n[${t("viewTranscript")}](${transcriptUrl})`;
  } else if (localTranscript) {
    content += `\n[${t("viewTranscript")}](${localTranscript})`;
  }

  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle status/resolution selection - update database
 */
async function handleStatusSelect(
  interaction: StringSelectMenuInteraction,
  ticketId: number,
  selectedValue: string,
  t: (key: string) => string,
  ticketRepo: InstanceType<typeof import("../../repositories/ticket.repository").TicketRepository>
) {
  try {
    await ticketRepo.updateTicketResolution(ticketId, selectedValue);
  } catch (dbError) {
    logger.error("Failed to update ticket resolution:", dbError);
    await interaction.reply({
      content: t("error"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Return to main menu - deferUpdate first to acknowledge, then edit
  await interaction.deferUpdate();

  const mainMenuRow = buildMainMenu(ticketId, t);
  await interaction.editReply({
    components: [...getExistingComponentsExceptSelectMenu(interaction), mainMenuRow],
  });

  // Send success message as a separate followUp (safe after deferUpdate)
  await interaction.followUp({
    content: t("statusUpdated").replace("{{status}}", t(`resolution_${selectedValue}`)),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle category selection - update database
 */
async function handleCategorySelect(
  interaction: StringSelectMenuInteraction,
  ticketId: number,
  selectedValue: string,
  t: (key: string) => string,
  ticketRepo: InstanceType<typeof import("../../repositories/ticket.repository").TicketRepository>
) {
  try {
    await ticketRepo.updateTicketCategory(ticketId, selectedValue);
  } catch (dbError) {
    logger.error("Failed to update ticket category:", dbError);
    await interaction.reply({
      content: t("error"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Return to main menu - deferUpdate first to acknowledge, then edit
  await interaction.deferUpdate();

  const mainMenuRow = buildMainMenu(ticketId, t);
  await interaction.editReply({
    components: [...getExistingComponentsExceptSelectMenu(interaction), mainMenuRow],
  });

  // Send success message as a separate followUp (safe after deferUpdate)
  await interaction.followUp({
    content: t("categoryUpdated").replace("{{category}}", t(`category_${selectedValue}`)),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle rating selection - update database
 */
async function handleRatingSelect(
  interaction: StringSelectMenuInteraction,
  ticketId: number,
  selectedValue: string,
  t: (key: string) => string,
  ticketRepo: InstanceType<typeof import("../../repositories/ticket.repository").TicketRepository>
) {
  const rating = parseInt(selectedValue, 10);

  // Validate rating is a valid number between 1-5
  if (isNaN(rating) || rating < 1 || rating > 5) {
    logger.warn(`Invalid rating value: ${selectedValue}`);
    await interaction.reply({
      content: t("error"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await ticketRepo.updateTicketRating(ticketId, rating);
  } catch (dbError) {
    logger.error("Failed to update ticket rating:", dbError);
    await interaction.reply({
      content: t("error"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Return to main menu - deferUpdate first to acknowledge, then edit
  await interaction.deferUpdate();

  const mainMenuRow = buildMainMenu(ticketId, t);
  await interaction.editReply({
    components: [...getExistingComponentsExceptSelectMenu(interaction), mainMenuRow],
  });

  // Send success message as a separate followUp (safe after deferUpdate)
  await interaction.followUp({
    content: t("ratingUpdated").replace("{{rating}}", selectedValue),
    flags: MessageFlags.Ephemeral,
  });
}

// ============================================
// Menu Builders
// ============================================

/**
 * Build main menu with all options (no selection)
 */
function buildMainMenu(
  ticketId: number,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.MAIN}:${ticketId}`)
    .setPlaceholder(t("mainPlaceholder"))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t("historyLabel"))
        .setDescription(t("historyDescription"))
        .setValue(TicketLogMenuOptions.HISTORY.value)
        .setEmoji(TicketLogMenuOptions.HISTORY.emoji),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("statusLabel"))
        .setDescription(t("statusDescription"))
        .setValue(TicketLogMenuOptions.STATUS.value)
        .setEmoji(TicketLogMenuOptions.STATUS.emoji),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("categoryLabel"))
        .setDescription(t("categoryDescription"))
        .setValue(TicketLogMenuOptions.CATEGORY.value)
        .setEmoji(TicketLogMenuOptions.CATEGORY.emoji),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("ratingLabel"))
        .setDescription(t("ratingDescription"))
        .setValue(TicketLogMenuOptions.RATING.value)
        .setEmoji(TicketLogMenuOptions.RATING.emoji)
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Build main menu with a specific option marked as selected (default)
 * This shows which submenu is currently open
 */
function buildMainMenuWithSelection(
  ticketId: number,
  selectedValue: string,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.MAIN}:${ticketId}`)
    .setPlaceholder(t("mainPlaceholder"))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t("historyLabel"))
        .setDescription(t("historyDescription"))
        .setValue(TicketLogMenuOptions.HISTORY.value)
        .setEmoji(TicketLogMenuOptions.HISTORY.emoji)
        .setDefault(selectedValue === TicketLogMenuOptions.HISTORY.value),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("statusLabel"))
        .setDescription(t("statusDescription"))
        .setValue(TicketLogMenuOptions.STATUS.value)
        .setEmoji(TicketLogMenuOptions.STATUS.emoji)
        .setDefault(selectedValue === TicketLogMenuOptions.STATUS.value),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("categoryLabel"))
        .setDescription(t("categoryDescription"))
        .setValue(TicketLogMenuOptions.CATEGORY.value)
        .setEmoji(TicketLogMenuOptions.CATEGORY.emoji)
        .setDefault(selectedValue === TicketLogMenuOptions.CATEGORY.value),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("ratingLabel"))
        .setDescription(t("ratingDescription"))
        .setValue(TicketLogMenuOptions.RATING.value)
        .setEmoji(TicketLogMenuOptions.RATING.emoji)
        .setDefault(selectedValue === TicketLogMenuOptions.RATING.value)
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Build history submenu with user's past tickets (no back option - use main menu above)
 */
function buildHistoryMenu(
  ticketId: number,
  history: Array<{ id: number; guildTicketId: number; closedAt: string | Date | null; closeReason: string | null }>,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options: StringSelectMenuOptionBuilder[] = [];

  // Add history items (no back option - main menu is shown above)
  for (const ticket of history.slice(0, 25)) {
    const closedDate = ticket.closedAt
      ? new Date(ticket.closedAt).toLocaleDateString()
      : t("unknown");
    const reason = ticket.closeReason
      ? ticket.closeReason.substring(0, 50)
      : t("noReason");

    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`#${ticket.guildTicketId} - ${closedDate}`)
        .setDescription(reason)
        .setValue(ticket.id.toString())
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.HISTORY}:${ticketId}`)
    .setPlaceholder(t("historyPlaceholder"))
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Build status/resolution submenu (no back option - use main menu above)
 */
function buildStatusMenu(
  ticketId: number,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.STATUS}:${ticketId}`)
    .setPlaceholder(t("statusPlaceholder"))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t("resolution_resolved"))
        .setDescription(t("resolution_resolved_desc"))
        .setValue(TicketResolution.RESOLVED)
        .setEmoji("✅"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("resolution_unresolved"))
        .setDescription(t("resolution_unresolved_desc"))
        .setValue(TicketResolution.UNRESOLVED)
        .setEmoji("❌"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("resolution_follow_up"))
        .setDescription(t("resolution_follow_up_desc"))
        .setValue(TicketResolution.FOLLOW_UP)
        .setEmoji("🔄"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("resolution_abuse"))
        .setDescription(t("resolution_abuse_desc"))
        .setValue(TicketResolution.ABUSE)
        .setEmoji("⚠️")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Build category submenu (no back option - use main menu above)
 */
function buildCategoryMenu(
  ticketId: number,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.CATEGORY}:${ticketId}`)
    .setPlaceholder(t("categoryPlaceholder"))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_technical"))
        .setDescription(t("category_technical_desc"))
        .setValue(TicketCategory.TECHNICAL)
        .setEmoji("🔧"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_billing"))
        .setDescription(t("category_billing_desc"))
        .setValue(TicketCategory.BILLING)
        .setEmoji("💰"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_general"))
        .setDescription(t("category_general_desc"))
        .setValue(TicketCategory.GENERAL)
        .setEmoji("❓"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_report"))
        .setDescription(t("category_report_desc"))
        .setValue(TicketCategory.REPORT)
        .setEmoji("🚨"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_feedback"))
        .setDescription(t("category_feedback_desc"))
        .setValue(TicketCategory.FEEDBACK)
        .setEmoji("📝"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("category_abuse"))
        .setDescription(t("category_abuse_desc"))
        .setValue(TicketCategory.ABUSE)
        .setEmoji("⚠️")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Build rating submenu (1-5 stars, no back option - use main menu above)
 */
function buildRatingMenu(
  ticketId: number,
  t: (key: string) => string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${TicketLogMenuAction.RATING}:${ticketId}`)
    .setPlaceholder(t("ratingPlaceholder"))
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(t("rating_5"))
        .setDescription(t("rating_5_desc"))
        .setValue("5")
        .setEmoji("⭐"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("rating_4"))
        .setDescription(t("rating_4_desc"))
        .setValue("4")
        .setEmoji("⭐"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("rating_3"))
        .setDescription(t("rating_3_desc"))
        .setValue("3")
        .setEmoji("⭐"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("rating_2"))
        .setDescription(t("rating_2_desc"))
        .setValue("2")
        .setEmoji("⭐"),
      new StringSelectMenuOptionBuilder()
        .setLabel(t("rating_1"))
        .setDescription(t("rating_1_desc"))
        .setValue("1")
        .setEmoji("⭐")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Export the main menu builder for use in DiscordService
 */
export { buildMainMenu as buildTicketLogMainMenu };

/**
 * Get all existing components from the message EXCEPT select menus
 * This preserves Container, Button rows, etc. while allowing select menu replacement
 *
 * Note: Uses any[] due to complex discord.js component types that don't have a
 * common base type covering both Container JSON and ActionRowBuilder instances.
 * The spread operator in components arrays accepts these mixed types at runtime.
 */
function getExistingComponentsExceptSelectMenu(
  interaction: StringSelectMenuInteraction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any[] = [];

  for (const component of interaction.message.components) {
    // Keep Container components as-is (type 17)
    if (component.type === ComponentType.Container) {
      components.push(component.toJSON());
      continue;
    }

    // Keep ActionRow components that contain buttons (not select menus)
    if (component.type === ComponentType.ActionRow) {
      const firstChild = component.components[0];
      // Keep if it's a button row (type 2), skip if it's a select menu (type 3)
      if (firstChild && firstChild.type === ComponentType.Button) {
        components.push(ActionRowBuilder.from(component));
      }
      // Skip select menu rows - they will be replaced
    }
  }

  return components;
}

export default selectMenu;
