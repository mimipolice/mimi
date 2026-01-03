import {
  SlashCommandBuilder,
  CommandInteraction,
  ContainerBuilder,
  Locale,
  Client,
  SeparatorBuilder,
  TextDisplayBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import { getOdogRankings } from "../../../repositories/gacha.repository";
import { getGachaPoolsCache } from "../../../shared/cache";
import { poolTypeNames } from "../../../config/gacha";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

import { Command, Databases, Services } from "../../../interfaces/Command";

export default {
  data: new SlashCommandBuilder()
    .setName("odog")
    .setDescription("Show the Odog rankings.")
    .setNameLocalizations({
      [Locale.EnglishUS]: "odog",
      [Locale.ChineseTW]: "歐皇榜",
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: "Show the Odog rankings.",
      [Locale.ChineseTW]: "顯示歐皇榜。",
    })
    .addStringOption((option) =>
      option
        .setName("gacha_id")
        .setDescription("The gacha pool to check.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "gacha_id",
          [Locale.ChineseTW]: "卡池id",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "The gacha pool to check.",
          [Locale.ChineseTW]: "要查詢的卡池。",
        })
        .setRequired(false)
        .setChoices(
          ...Object.entries(poolTypeNames).map(([value, name]) => ({
            name,
            value,
          }))
        )
    )
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("The period to check.")
        .setNameLocalizations({
          [Locale.EnglishUS]: "period",
          [Locale.ChineseTW]: "期間",
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: "The period to check.",
          [Locale.ChineseTW]: "要查詢的期間。",
        })
        .setRequired(false)
    ),

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    const translations = getLocalizations(localizationManager, "odog");
    const t = translations[interaction.locale] || translations["en-US"];

    // Only defer if not already deferred or replied
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const gachaId = interaction.options.getString(
        translations["en-US"].options.gacha_id.name
      );
      const period =
        interaction.options.getString(
          translations["en-US"].options.period.name
        ) ?? "7d";
      const days = period === "all" ? "all" : parseInt(period.replace("d", ""));

      if (isNaN(days as number) && days !== "all") {
        await interaction.editReply({
          content: t.responses.invalid_period,
        });
        return;
      }

      const rankings = await getOdogRankings(gachaId, days as number | "all");

      if (rankings.length === 0) {
        await interaction.editReply(t.responses.no_ranking_data);
        return;
      }

      const container = new ContainerBuilder();
      container.setAccentColor(0xffd700);

      const gachaPools = getGachaPoolsCache();
      const gachaPoolInfo = gachaId
        ? gachaPools.find((p) => p.gacha_id === gachaId)
        : null;
      const gachaName =
        (gachaId && (poolTypeNames as Record<string, string>)[gachaId]) ||
        (gachaPoolInfo
          ? `${gachaPoolInfo.gacha_name} (${gachaPoolInfo.gacha_name_alias})`
          : t.responses.global);

      const titleText = t.responses.title
        .replace("{{gachaName}}", gachaName);

      // Header with title
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${titleText}`)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      const rarityEmojis: { [key: string]: string } = {
        "7": "<:t7:1403031930164744222>",
        "6": "<:t6:1403031970727985214>",
        "5": "<:t5:1403031998381031505>",
        "4": "<:t4:1403032033428504596>",
        "3": "<:t3:1403032061949907105>",
        "2": "<:t2:1403032084036980756>",
        "1": "<:t1:1403032106950721646>",
      };

      // Build individual rank entries with better visual hierarchy
      rankings.slice(0, 10).forEach((user, index) => {
        const rank = index + 1;
        const username = user.nickname || `User ${user.user_id}`;

        // Format rarity counts in a cleaner way
        const rarityDetails = user.rarity_counts
          ? Object.entries(user.rarity_counts)
              .sort(([a], [b]) => Number(b) - Number(a))
              .filter(([, count]) => count > 0)
              .map(
                ([rarity, count]) =>
                  `${rarityEmojis[rarity] || "R" + rarity} ×${count}`
              )
              .join("  ")
          : t.responses.no_top_tier;

        const totalDraws = t.responses.user_rank_summary.replace(
          "{{totalDraws}}",
          `${user.total_draws.toString()}`
        );

        // Create a section for each rank entry
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${rank}.** ${username}\n` +
            `-# ${rarityDetails}\n` +
            `-# ${totalDraws}`
          )
        );

        // Add small separator between entries (except after last)
        if (index < Math.min(rankings.length - 1, 9)) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
      });

      // Footer with period info
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# ${t.responses.period_label}: ${period}`
        )
      );

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      logger.error(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: t.responses.error_fetching,
        });
      }
    }
  },
};
