// src/utils/chart-generator.ts

import { createCanvas } from "canvas";
import {
  Chart,
  ChartConfiguration,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
} from "chart.js";
import "chartjs-adapter-moment";

// Register the necessary components for a bar chart with time scale
Chart.register(
  TimeScale,
  TimeSeriesScale,
  LinearScale,
  BarController,
  BarElement,
  CategoryScale
);

// NEW: Configurable chart defaults
const CHART_DEFAULTS = {
  WIDTH: 900,
  HEIGHT: 506.25,
};

interface OhlcData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartExtraInfo {
  latestOhlc: OhlcData;
  change: number;
  changePercent: number;
}

// Custom plugin to draw the wicks for the candlestick chart
const candlestickWicksPlugin = {
  id: "candlestickWicks",
  afterDraw: (chart: Chart) => {
    const { ctx } = chart;
    ctx.save();
    const meta = chart.getDatasetMeta(0); // Price data
    meta.data.forEach((element, index) => {
      const ohlc = chart.data.datasets[0].data[index] as unknown as OhlcData;
      const bar = element as any;

      ctx.strokeStyle = bar.options.borderColor;
      ctx.lineWidth = Math.max(1, bar.width * 0.1); // Make wick width proportional to bar width

      // High-low wick
      ctx.beginPath();
      ctx.moveTo(bar.x, chart.scales.yPrice.getPixelForValue(ohlc.high));
      ctx.lineTo(bar.x, chart.scales.yPrice.getPixelForValue(ohlc.low));
      ctx.stroke();
    });
    ctx.restore();
  },
};

const createYAxisSeparatorPlugin = (darkMode: boolean) => ({
  id: "yAxisSeparator",
  afterDraw: (chart: Chart) => {
    const { ctx, scales, chartArea } = chart;
    const { yPrice } = scales;

    if (yPrice && chartArea) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yPrice.bottom);
      ctx.lineTo(chartArea.right, yPrice.bottom);
      ctx.strokeStyle = darkMode
        ? "rgba(255, 255, 255, 0.5)"
        : "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  },
});

const createChartAreaBorderPlugin = (darkMode: boolean) => ({
  id: "chartAreaBorder",
  afterDraw: (chart: Chart) => {
    const { ctx, chartArea } = chart;
    if (chartArea) {
      ctx.save();
      ctx.strokeStyle = darkMode
        ? "rgba(255, 255, 255, 0.5)"
        : "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        chartArea.left,
        chartArea.top,
        chartArea.width,
        chartArea.height
      );
      ctx.restore();
    }
  },
});

export async function generateCandlestickChart(
  ohlcData: OhlcData[],
  assetSymbol: string,
  intervalLabel: string,
  extraInfo: ChartExtraInfo,
  darkMode = true
): Promise<Buffer> {
  const width = CHART_DEFAULTS.WIDTH;
  const height = CHART_DEFAULTS.HEIGHT;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const upColor = "#22c55e";
  const downColor = "#ef4444";
  const textColor = darkMode ? "rgba(255, 255, 255, 0.9)" : "black";
  const mutedTextColor = darkMode ? "rgba(255, 255, 255, 0.6)" : "#555";
  const ohlcLabelColor = "#facc15"; // Light Yellow
  const gridColor = darkMode
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";

  // 找出 Y 軸的最高與最低點，並加上一點 padding
  const yAxisHigh = Math.max(...ohlcData.map((d) => d.high));
  const yAxisLow = Math.min(...ohlcData.map((d) => d.low));
  const yAxisPadding = (yAxisHigh - yAxisLow) * 0.1; // 10% 的 padding

  const configuration: ChartConfiguration = {
    type: "bar",
    data: {
      datasets: [
        {
          label: `${assetSymbol} Price`,
          data: ohlcData.map((d) => ({
            x: d.timestamp.getTime(),
            y: [d.open, d.close], // Floating bar for open/close
            high: d.high,
            low: d.low,
          })) as any,
          backgroundColor: ohlcData.map((d) =>
            d.close >= d.open ? upColor : downColor
          ),
          borderColor: ohlcData.map((d) =>
            d.close >= d.open ? upColor : downColor
          ),
          yAxisID: "yPrice",
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        },
        {
          label: "Volume",
          data: ohlcData.map((d) => ({
            x: d.timestamp.getTime(),
            y: d.volume,
          })),
          backgroundColor: ohlcData.map((d) =>
            d.close >= d.open
              ? "rgba(34, 197, 94, 0.5)"
              : "rgba(239, 68, 68, 0.5)"
          ),
          yAxisID: "yVolume",
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        },
      ],
    },
    options: {
      layout: { padding: { top: 100, left: 10, right: 20, bottom: 10 } },
      scales: {
        x: {
          type: "time",
          offset: false,
          time: {
            minUnit: intervalLabel.endsWith("m")
              ? "minute"
              : intervalLabel.endsWith("h")
              ? "hour"
              : "day",
          },
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 14 },
            maxTicksLimit: 10,
          },
        },
        yVolume: {
          type: "linear",
          position: "left",
          stack: "main",
          stackWeight: 1,
          grace: "5%",
          grid: { drawOnChartArea: false },
          ticks: {
            color: textColor,
            font: { size: 14 },
            padding: 10,
            callback: function (value, index, ticks) {
              // Hide the last tick (top of the volume axis)
              if (index === ticks.length - 1) return null;
              return value;
            },
          },
          title: {
            display: true,
            text: "Volume",
            color: textColor,
            font: { size: 16 },
          },
        },
        yPrice: {
          type: "linear",
          position: "left",
          stack: "main",
          stackWeight: 4,
          grid: { color: gridColor },
          min: yAxisLow - yAxisPadding,
          max: yAxisHigh + yAxisPadding,
          ticks: {
            color: textColor,
            font: { size: 14 },
            padding: 10,
            callback: function (value, index, ticks) {
              // Hide the first tick (bottom of the price axis)
              if (index === 0) return null;
              if (typeof value === "number") {
                const valueStr = String(value);
                // Only format if there's a decimal part with more than 2 digits
                if (
                  valueStr.includes(".") &&
                  valueStr.split(".")[1].length > 2
                ) {
                  return value.toFixed(2);
                }
              }
              return value;
            },
          },
          title: {
            display: true,
            text: "Price",
            color: textColor,
            font: { size: 16 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true, mode: "index", intersect: false },
      },
    },
    plugins: [
      {
        id: "customCanvasBackgroundColor",
        beforeDraw: (chart) => {
          const { ctx } = chart;
          ctx.save();
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = darkMode ? "#1E293B" : "white";
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      },
      candlestickWicksPlugin,
      createYAxisSeparatorPlugin(darkMode),
      createChartAreaBorderPlugin(darkMode),
    ],
  };

  new Chart(canvas as any, configuration);

  const { latestOhlc, change, changePercent } = extraInfo;
  const padding = 50;

  // Line 1: Centered Title
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.fillText(
    `${assetSymbol.toUpperCase()} • ${intervalLabel}`,
    width / 2,
    40
  );

  // Line 2: OHLC and Change %
  const yPosLine2 = 75;
  ctx.font = "22px sans-serif";

  // --- Draw Change % on the right ---
  ctx.textAlign = "right";
  const changeSign = change >= 0 ? "+" : "";
  const changeColor = change >= 0 ? upColor : downColor;
  const changeText = `${changeSign}${change.toFixed(
    2
  )} (${changeSign}${changePercent.toFixed(2)}%)`;
  ctx.fillStyle = changeColor;
  ctx.fillText(changeText, width - padding, yPosLine2);

  // --- Draw OHLC on the left (with mixed colors) ---
  ctx.textAlign = "left";
  let currentX = padding;

  const drawOhlcPart = (label: string, value: string) => {
    // Draw Label
    ctx.fillStyle = ohlcLabelColor;
    ctx.fillText(label, currentX, yPosLine2);
    currentX += ctx.measureText(label).width;

    // Draw Value
    ctx.fillStyle = mutedTextColor;
    ctx.fillText(value, currentX, yPosLine2);
    currentX += ctx.measureText(value).width;
  };

  drawOhlcPart("O: ", `${latestOhlc.open.toFixed(2)}  `);
  drawOhlcPart("H: ", `${latestOhlc.high.toFixed(2)}  `);
  drawOhlcPart("L: ", `${latestOhlc.low.toFixed(2)}  `);
  drawOhlcPart("C: ", `${latestOhlc.close.toFixed(2)}`);

  return canvas.toBuffer("image/png");
}
