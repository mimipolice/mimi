/**
 * Validates if a string is a valid Discord emoji
 * @param emoji - The emoji string to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmoji(emoji: string): boolean {
  // Check for custom Discord emoji format: <:name:id> or <a:name:id>
  const customEmojiRegex = /^<a?:\w+:\d+>$/;
  if (customEmojiRegex.test(emoji)) {
    return true;
  }

  // Check for Unicode emoji
  // This regex matches most Unicode emoji sequences
  const unicodeEmojiRegex =
    /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;
  if (unicodeEmojiRegex.test(emoji)) {
    return true;
  }

  // Check for simple emoji ID format (for reactions): name:id
  const simpleCustomEmojiRegex = /^\w+:\d+$/;
  if (simpleCustomEmojiRegex.test(emoji)) {
    return true;
  }

  return false;
}

/**
 * Extracts emoji identifier for Discord API
 * @param emoji - The emoji string
 * @returns The emoji identifier suitable for Discord API
 */
export function getEmojiIdentifier(emoji: string): string {
  // If it's a custom emoji <:name:id> or <a:name:id>, extract name:id
  const customEmojiMatch = emoji.match(/<a?:(\w+):(\d+)>/);
  if (customEmojiMatch) {
    return `${customEmojiMatch[1]}:${customEmojiMatch[2]}`;
  }

  // Otherwise return as-is (Unicode emoji or already in name:id format)
  return emoji;
}
