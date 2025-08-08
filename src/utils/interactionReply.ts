import { InteractionReplyOptions } from "discord.js";
import { createReply } from "./replyHelper";
import { LocalizationManager } from "../services/LocalizationManager";

const localizationManager = new LocalizationManager();

function getLocale(interaction: { locale: string }): string {
  return interaction.locale;
}

export function createUnauthorizedReply(interaction: {
  locale: string;
}): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "unauthorized",
    getLocale(interaction)
  );
}

export function createBusinessErrorReply(
  interaction: { locale: string },
  message: string
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "businessError",
    getLocale(interaction),
    { message }
  );
}

export function createCheckFailureReply(
  interaction: { locale: string },
  message: string
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "checkFailure",
    getLocale(interaction),
    { message }
  );
}

export function createCooldownReply(
  interaction: { locale: string },
  remaining: number
): InteractionReplyOptions {
  return createReply(localizationManager, "cooldown", getLocale(interaction), {
    remaining,
  });
}

export function createInternalErrorReply(interaction: {
  locale: string;
}): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "internalError",
    getLocale(interaction)
  );
}

export function createAutoModBlockedReply(interaction: {
  locale: string;
}): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "autoModBlocked",
    getLocale(interaction)
  );
}

export function createDiscordErrorReply(interaction: {
  locale: string;
}): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "discordError",
    getLocale(interaction)
  );
}

export function createMissingPermissionsReply(interaction: {
  locale: string;
}): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "missingPermissions",
    getLocale(interaction)
  );
}
