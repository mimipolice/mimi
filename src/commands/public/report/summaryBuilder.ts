import { TextDisplayBuilder } from "@discordjs/builders";
import moment from "moment";

// A type for the translation function to keep things clean
type TFunction = (
  key: string,
  replacements?: { [key: string]: string | number }
) => string;

// A type for the data object to ensure type safety
interface ReportData {
  latestOhlc: { close: number };
  change: number;
  changePercent: number;
  overallHigh: number;
  overallLow: number;
  avgPrice: number;
  startPrice: number;
  endPrice: number;
  totalChangeValue: number;
  totalChangePercent: number;
  highTimestamp: number;
  lowTimestamp: number;
  volatilityValue: number;
  volatilityPercent: number;
  rawDataPointCount: number;
  startTime: string;
  endTime: string;
  durationHuman: string;
  totalVolume: number;
  avgVolume: number;
  highVolumeRecord: { volume: number; timestamp: Date };
  lowVolumeRecord: { volume: number; timestamp: Date };
  highVolumeTimestamp: number;
  lowVolumeTimestamp: number;
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function buildSummaryText(
  view: "price" | "detailed" | "volume",
  t: TFunction,
  data: ReportData
): TextDisplayBuilder {
  let content: string[] = [];

  switch (view) {
    case "price":
      content = [
        t("responses.range_high", { price: formatPrice(data.overallHigh) }),
        t("responses.range_low", { price: formatPrice(data.overallLow) }),
        t("responses.range_avg", { price: formatPrice(data.avgPrice) }),
      ];
      break;

    case "detailed":
      content = [
        t("responses.start_price", { price: formatPrice(data.startPrice) }),
        t("responses.end_price", { price: formatPrice(data.endPrice) }),
        t("responses.total_change_value", {
          change: formatPercent(data.totalChangeValue),
        }),
        t("responses.total_change_percent", {
          percent: formatPercent(data.totalChangePercent),
        }),
        t("responses.high_price", {
          price: formatPrice(data.overallHigh),
          timestamp: data.highTimestamp.toString(),
        }),
        t("responses.low_price", {
          price: formatPrice(data.overallLow),
          timestamp: data.lowTimestamp.toString(),
        }),
        t("responses.avg_price", { price: formatPrice(data.avgPrice) }),
        t("responses.volatility", {
          value: formatPrice(data.volatilityValue),
          percent: data.volatilityPercent.toFixed(2),
        }),
      ];
      break;

    case "volume":
      content = [
        t("responses.total_volume", {
          volume: data.totalVolume.toLocaleString(),
        }),
        t("responses.avg_volume", { volume: formatPrice(data.avgVolume) }),
        t("responses.high_volume", {
          volume: data.highVolumeRecord.volume.toLocaleString(),
          timestamp: data.highVolumeTimestamp.toString(),
        }),
        t("responses.low_volume", {
          volume: data.lowVolumeRecord.volume.toLocaleString(),
          timestamp: data.lowVolumeTimestamp.toString(),
        }),
        t("responses.data_points", {
          count: data.rawDataPointCount.toString(),
        }),
        t("responses.time_span", {
          start: moment(data.startTime).format("YYYY-MM-DD HH:mm:ss"),
          end: moment(data.endTime).format("YYYY-MM-DD HH:mm:ss"),
          duration: data.durationHuman,
        }),
      ];
      break;
  }

  return new TextDisplayBuilder().setContent(content.join("\n"));
}
