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

import { Databases, Services } from "../../../interfaces/Command";

const translations = getLocalizations("odog");

export default {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.EnglishUS]: translations["en-US"].name,
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: translations["en-US"].description,
      [Locale.ChineseTW]: translations["zh-TW"].description,
    })
    .setDefaultMemberPermissions(0)
    .addStringOption((option) =>
      option
        .setName(translations["en-US"].options.gacha_id.name)
        .setDescription(translations["en-US"].options.gacha_id.description)
        .setNameLocalizations({
          [Locale.EnglishUS]: translations["en-US"].options.gacha_id.name,
          [Locale.ChineseTW]: translations["zh-TW"].options.gacha_id.name,
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]:
            translations["en-US"].options.gacha_id.description,
          [Locale.ChineseTW]:
            translations["zh-TW"].options.gacha_id.description,
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
        .setName(translations["en-US"].options.period.name)
        .setDescription(translations["en-US"].options.period.description)
        .setNameLocalizations({
          [Locale.EnglishUS]: translations["en-US"].options.period.name,
          [Locale.ChineseTW]: translations["zh-TW"].options.period.name,
        })
        .setDescriptionLocalizations({
          [Locale.EnglishUS]: translations["en-US"].options.period.description,
          [Locale.ChineseTW]: translations["zh-TW"].options.period.description,
        })
        .setRequired(false)
    ),

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    _services: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

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
