import { InteractionReplyOptions } from "discord.js";
import { createReply } from "./replyHelper";
import { LocalizationManager } from "../services/LocalizationManager";

function getLocale(interaction: { locale: string }): string {
  return interaction.locale;
}

export function createUnauthorizedReply(
  localizationManager: LocalizationManager,
  interaction: {
    locale: string;
  }
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "unauthorized",
    getLocale(interaction)
  );
}

export function createBusinessErrorReply(
  localizationManager: LocalizationManager,
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
  localizationManager: LocalizationManager,
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
  localizationManager: LocalizationManager,
  interaction: { locale: string },
  remaining: number
): InteractionReplyOptions {
  return createReply(localizationManager, "cooldown", getLocale(interaction), {
    remaining,
  });
}

export function createInternalErrorReply(
  localizationManager: LocalizationManager,
  interaction: {
    locale: string;
  }
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "internalError",
    getLocale(interaction)
  );
}

export function createAutoModBlockedReply(
  localizationManager: LocalizationManager,
  interaction: {
    locale: string;
  }
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "autoModBlocked",
    getLocale(interaction)
  );
}

export function createDiscordErrorReply(
  localizationManager: LocalizationManager,
  interaction: {
    locale: string;
  }
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "discordError",
    getLocale(interaction)
  );
}

export function createMissingPermissionsReply(
  localizationManager: LocalizationManager,
  interaction: {
    locale: string;
  }
): InteractionReplyOptions {
  return createReply(
    localizationManager,
    "missingPermissions",
    getLocale(interaction)
  );
}
