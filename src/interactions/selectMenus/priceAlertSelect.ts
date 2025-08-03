import { StringSelectMenuInteraction } from "discord.js";
import {
  createPriceAlert,
  getAllAssetsWithLatestPrice,
  findNextAvailablePriceAlertId,
} from "../../shared/database/queries";
import logger from "../../utils/logger";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

export default {
  name: "pricealert-select",
  async execute(interaction: StringSelectMenuInteraction) {
    try {
      const [_, condition, targetPriceStr] = interaction.customId.split(":");
      const targetPrice = parseFloat(targetPriceStr);
      const selectedSymbol = interaction.values[0];
      const userId = interaction.user.id;

      if (!condition || isNaN(targetPrice) || !selectedSymbol) {
        await interaction.update({
          content: "❌ 處理您的選擇時發生錯誤，參數遺失。",
          components: [],
        });
        return;
      }

      // --- 取得完整資產資訊 ---
      const assetListPath = path.join(
        __dirname,
        "..",
        "..",
        "config",
        "asset-list.yml"
      );
      const assetList = yaml.load(fs.readFileSync(assetListPath, "utf8")) as {
        asset_symbol: string;
        asset_name: string;
      }[];
      const asset = assetList.find((a) => a.asset_symbol === selectedSymbol);
      if (!asset) {
        await interaction.update({
          content: `❌ 處理您的選擇時發生錯誤，找不到資產 ${selectedSymbol}。`,
          components: [],
        });
        return;
      }

      // --- 取得目前價格 ---
      const allAssets = await getAllAssetsWithLatestPrice();
      const currentAsset = allAssets.find(
        (a) => a.asset_symbol === asset.asset_symbol
      );
      const currentPrice = currentAsset ? currentAsset.price : null;

      // --- 建立提醒 ---
      const nextId = await findNextAvailablePriceAlertId(userId);
      await createPriceAlert(
        nextId,
        userId,
        asset.asset_symbol,
        condition as "above" | "below",
        targetPrice,
        false,
        interaction.locale
      );

      // --- 回覆詳細訊息 ---
      let reply = `✅ **已成功設定價格提醒！**\n`;
      reply += `> **公司:** ${asset.asset_name} (${asset.asset_symbol})\n`;
      reply += `> **條件:** 當價格 **${
        condition === "above" ? "高於" : "低於"
      } ${targetPrice}**\n`;
      if (currentPrice !== null) {
        reply += `> **目前價格:** ${currentPrice.toFixed(2)}`;
      } else {
        reply += `> **目前價格:** 尚無資料`;
      }

      await interaction.update({
        content: reply,
        components: [], // 移除選單
      });
    } catch (error) {
      logger.error("Error executing price alert select menu:", error);
      await interaction.update({
        content: "處理您的選擇時發生了未預期的錯誤。",
        components: [],
      });
    }
  },
};
