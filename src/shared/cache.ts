import {
  Keyword,
  AutoReact,
  getAllKeywords,
  getAllAutoreacts,
} from "./database/queries";

export { Keyword };

// In-memory cache
export let autoReactCache = new Map<string, string>();
export let keywordCache = new Map<string, Keyword[]>();

export async function loadCaches() {
  // Load auto-reactions
  const autoreacts = await getAllAutoreacts();
  autoReactCache.clear();
  for (const ar of autoreacts) {
    autoReactCache.set(ar.channel_id, ar.emoji);
  }
  console.log(`Loaded ${autoReactCache.size} auto-reactions into cache.`);

  // Load keywords
  const keywords = await getAllKeywords();
  keywordCache.clear();
  for (const kw of keywords) {
    if (!keywordCache.has(kw.guild_id)) {
      keywordCache.set(kw.guild_id, []);
    }
    keywordCache.get(kw.guild_id)!.push(kw);
  }
  console.log(`Loaded ${keywords.length} keywords into cache.`);
}
