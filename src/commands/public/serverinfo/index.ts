import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Client,
    AttachmentBuilder,
    Locale,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import { generateServerCard } from "../../../utils/server-card-generator";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Display server information with a cool card")
        .setNameLocalizations({
            [Locale.ChineseTW]: "伺服器資訊",
        })
        .setDescriptionLocalizations({
            [Locale.ChineseTW]: "顯示伺服器資訊卡片",
        }),
    detailedHelpPath: "src/commands/help_docs/public/serverinfo.md", // Note: This file needs to be created or referenced
    async execute(
        interaction: ChatInputCommandInteraction,
        client: Client,
        { localizationManager }: Services
    ) {
        await interaction.deferReply();

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply("This command can only be used in a server.");
            return;
        }

        // Fetch necessary data
        // Note: Some data fetching might be async and require awaiting
        const owner = await guild.fetchOwner();

        // Get approximate member counts (might be cached)
        const members = guild.memberCount;
        // For online count, we'd ideally need to fetch presences, but that can be heavy.
        // For now, let's use a placeholder or approximate if available.
        // In large guilds without intent, accurate presence count is hard.
        // We'll just use the total member count or approximate.
        // A more accurate way involves fetching all members which is slow.
        const online = guild.presences.cache.filter(p => p.status !== 'offline').size;

        const channels = guild.channels.cache.size;
        const roles = guild.roles.cache.size;
        const emojis = guild.emojis.cache.size;
        const stickers = guild.stickers.cache.size;

        const createdDate = guild.createdAt.toLocaleDateString("en-US", {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        try {
            const buffer = await generateServerCard({
                id: guild.id,
                name: guild.name,
                iconUrl: guild.iconURL({ extension: "png", size: 512 }) || "https://cdn.discordapp.com/embed/avatars/0.png",
                bannerUrl: guild.bannerURL({ extension: "png", size: 1024 }) || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop", // Fallback banner
                owner: owner.user.username,
                description: guild.description || "No description set for this server.",
                vanityUrl: guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : undefined,
                isVerified: guild.verified,
                tags: guild.features.slice(0, 5), // Limit tags to 5 to fit
                specs: {
                    locale: guild.preferredLocale,
                    verificationLevel: guild.verificationLevel.toString(),
                    nsfwLevel: guild.nsfwLevel.toString(),
                    createdDate: createdDate,
                },
                stats: {
                    members: members,
                    online: online, // This might be 0 if presences intent is missing
                    boosts: guild.premiumSubscriptionCount || 0,
                    boostLevel: guild.premiumTier,
                    assets: {
                        emojis: emojis,
                        stickers: stickers,
                    },
                    structure: {
                        channels: channels,
                        roles: roles,
                    },
                },
            });

            const attachment = new AttachmentBuilder(buffer, { name: "server-info.png" });

            await interaction.editReply({
                files: [attachment],
            });
        } catch (error) {
            console.error("Error generating server card:", error);
            await interaction.editReply("Failed to generate server info card.");
        }
    },
};
