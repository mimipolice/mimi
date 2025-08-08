export interface LocaleStrings {
  author?: string;
  description?: string;
  footer?: string;
}

export interface GlobalLocale {
  unauthorized: LocaleStrings;
  businessError: LocaleStrings;
  checkFailure: LocaleStrings;
  cooldown: LocaleStrings;
  internalError: LocaleStrings;
  autoModBlocked: LocaleStrings;
  discordError: LocaleStrings;
  missingPermissions: LocaleStrings;
  supportServer: string;
}
