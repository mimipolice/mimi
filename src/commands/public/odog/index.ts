import {
  SlashCommandBuilder,
  CommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  Locale,
  Client,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import { getOdogRankings } from "../../../shared/database/queries";
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

    await interaction.deferReply();

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
      container.setAccentColor(0xffd700); // Gold color for rankings
      container.setSpoiler(true);

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
        .replace("{{gachaName}}", gachaName)
        .replace("{{period}}", period);

      const title = new TextDisplayBuilder().setContent(`# ${titleText}`);
      container.components.push(title, new SeparatorBuilder());

      rankings.slice(0, 15).forEach((user, index) => {
        const rarityDetails = user.rarity_counts
          ? Object.entries(user.rarity_counts)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rarity, count]) => `R${rarity}: ${count}`)
              .join(" | ")
          : t.responses.no_top_tier;

        const userRankText = new TextDisplayBuilder().setContent(
          t.responses.user_rank_line
            .replace("{{rank}}", (index + 1).toString())
            .replace("{{nickname}}", user.nickname || `User ${user.user_id}`)
            .replace("{{rarityDetails}}", rarityDetails)
            .replace("{{totalDraws}}", user.total_draws.toString())
        );
        container.components.push(userRankText);
      });

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
