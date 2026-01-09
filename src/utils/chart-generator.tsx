/** @jsxImportSource react */
// src/utils/chart-generator.ts
// K-line chart generator using Takumi

import React from "react";
import { ImageResponse } from "@takumi-rs/image-response";

// ============================================
// Interfaces (exported for external use)
// ============================================

export interface OhlcData {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ChartExtraInfo {
    latestOhlc: OhlcData;
    change: number;
    changePercent: number;
}

// ============================================
// Design Tokens
// ============================================

const COLORS = {
    up: "#26a69a", // Teal (softer green)
    down: "#ef5350", // Red 400 (softer red)
    upVol: "rgba(38, 166, 154, 0.5)",
    downVol: "rgba(239, 83, 80, 0.5)",
    bg: "#101623",
    text: "rgba(255, 255, 255, 0.95)",
    textMuted: "rgba(255, 255, 255, 0.6)", // Slightly more readable
    grid: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.15)",
    accent: "#fbbf24", // Amber 400 (softer accent)
};

const DIMENSIONS = {
    width: 900,
    height: 506,
    margin: { top: 80, right: 20, bottom: 30, left: 60 },
    gap: 24,
};

// ============================================
// Helper Functions
// ============================================

const formatPrice = (val: number): string => {
    if (val >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (val >= 100) return val.toFixed(1);
    return val.toFixed(2);
};

const formatVolume = (val: number): string => {
    if (val >= 1e6) return (val / 1e6).toFixed(1) + "M";
    if (val >= 1e3) return (val / 1e3).toFixed(1) + "K";
    return val.toFixed(0);
};

const formatHeaderPrice = (val: number): string => {
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatXAxisLabel = (date: Date, rangeMs: number): string => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (rangeMs < ONE_DAY * 2) {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else if (rangeMs < ONE_DAY * 10) {
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}h`;
    } else {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
};

// ============================================
// Chart Component
// ============================================

function CandlestickChart({
    ohlcData,
    assetSymbol,
    intervalLabel,
    extraInfo,
}: {
    ohlcData: OhlcData[];
    assetSymbol: string;
    intervalLabel: string;
    extraInfo: ChartExtraInfo;
}) {
    const { latestOhlc, change, changePercent } = extraInfo;

    // Calculate Ranges
    const allPrices = ohlcData.flatMap((d) => [d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;
    const yMin = minPrice - priceRange * 0.1;
    const yMax = maxPrice + priceRange * 0.1;
    const volMax = Math.max(...ohlcData.map((d) => d.volume)) * 1.1;
    const timeRangeMs = ohlcData[ohlcData.length - 1].timestamp.getTime() - ohlcData[0].timestamp.getTime();

    // Layout Calculations
    const { width, height, margin, gap } = DIMENSIONS;
    const contentWidth = width - margin.left - margin.right;
    const contentHeight = height - margin.top - margin.bottom;
    const priceHeight = Math.floor((contentHeight - gap) * 0.75);
    const volumeHeight = contentHeight - priceHeight - gap;
    const priceTop = margin.top;
    const volumeTop = priceTop + priceHeight + gap;
    const candleGap = contentWidth / ohlcData.length;
    const candleWidth = Math.max(2, candleGap * 0.7);

    // Scale Functions
    const scaleY = (val: number) => priceTop + priceHeight * (1 - (val - yMin) / (yMax - yMin));
    const scaleVol = (val: number) => volumeTop + volumeHeight * (1 - val / volMax);

    // Ticks
    const priceTickCount = 5;
    const priceStep = (yMax - yMin) / (priceTickCount - 1);
    const priceTicks = Array.from({ length: priceTickCount }, (_, i) => yMin + i * priceStep);

    // X-axis labels
    const maxXLabels = 6;
    const xLabelStep = Math.max(1, Math.floor(ohlcData.length / (maxXLabels - 1)));
    const xLabels = ohlcData
        .map((d, i) => ({ d, i }))
        .filter((_, i) => i % xLabelStep === 0 || i === ohlcData.length - 1)
        .filter((item, idx, arr) => {
            if (idx === 0) return true;
            const prev = arr[idx - 1];
            return (item.i - prev.i) * candleGap > 60;
        });

    // Styles
    const isUp = change >= 0;
    const changeColor = isUp ? COLORS.up : COLORS.down;
    const changeSign = isUp ? "+" : "";

    return (
        <div
            style={{
                width,
                height,
                backgroundColor: COLORS.bg,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                fontFamily: "sans-serif",
            }}
        >
            {/* Header */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: margin.top,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: `1px solid ${COLORS.border}`,
                    backgroundColor: "rgba(255,255,255,0.02)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ color: COLORS.text, fontSize: 26, fontWeight: 700, letterSpacing: "1px" }}>
                        {assetSymbol.toUpperCase()}
                    </span>
                    <span
                        style={{
                            color: COLORS.textMuted,
                            fontSize: 18,
                            marginLeft: 8,
                            backgroundColor: "rgba(255,255,255,0.1)",
                            padding: "2px 6px",
                            borderRadius: 4,
                        }}
                    >
                        {intervalLabel}
                    </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 60px" }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 15, fontFamily: "monospace" }}>
                        <span style={{ color: COLORS.accent }}>O: <span style={{ color: COLORS.textMuted }}>{formatHeaderPrice(latestOhlc.open)}</span></span>
                        <span style={{ color: COLORS.accent }}>H: <span style={{ color: COLORS.textMuted }}>{formatHeaderPrice(latestOhlc.high)}</span></span>
                        <span style={{ color: COLORS.accent }}>L: <span style={{ color: COLORS.textMuted }}>{formatHeaderPrice(latestOhlc.low)}</span></span>
                        <span style={{ color: COLORS.accent }}>C: <span style={{ color: COLORS.textMuted }}>{formatHeaderPrice(latestOhlc.close)}</span></span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: changeColor }}>
                        {changeSign}{formatHeaderPrice(change)} ({changeSign}{changePercent.toFixed(2)}%)
                    </div>
                </div>
            </div>

            {/* Grid Lines */}
            {priceTicks.map((p, i) => (
                <div
                    key={`grid-${i}`}
                    style={{
                        position: "absolute",
                        left: margin.left,
                        right: margin.right,
                        top: scaleY(p),
                        height: 1,
                        backgroundColor: COLORS.grid,
                    }}
                />
            ))}

            {/* Y-Axis Labels (Price) */}
            {priceTicks.map((p, i) => (
                <div
                    key={`label-${i}`}
                    style={{
                        position: "absolute",
                        left: 0,
                        width: margin.left - 8,
                        top: scaleY(p) - 10,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                    }}
                >
                    <span style={{ color: COLORS.textMuted, fontSize: 14, fontFamily: "monospace" }}>
                        {formatPrice(p)}
                    </span>
                </div>
            ))}

            {/* Volume Labels */}
            <div style={{ position: "absolute", left: 0, top: scaleVol(volMax) - 10, width: margin.left - 8, height: 20, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ color: COLORS.textMuted, fontSize: 14, fontFamily: "monospace" }}>{formatVolume(volMax)}</span>
            </div>
            <div style={{ position: "absolute", left: 0, top: scaleVol(0) - 10, width: margin.left - 8, height: 20, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ color: COLORS.textMuted, fontSize: 14, fontFamily: "monospace" }}>0</span>
            </div>

            {/* Candles */}
            {ohlcData.map((d, i) => {
                const isUp = d.close >= d.open;
                const color = isUp ? COLORS.up : COLORS.down;
                const x = margin.left + i * candleGap;
                const top = scaleY(Math.max(d.open, d.close));
                const bottom = scaleY(Math.min(d.open, d.close));
                const height = Math.max(1, bottom - top);
                const wickTop = scaleY(d.high);
                const wickHeight = scaleY(d.low) - wickTop;

                return (
                    <React.Fragment key={`c-${i}`}>
                        <div
                            style={{
                                position: "absolute",
                                left: x + candleWidth / 2 - 0.5,
                                top: wickTop,
                                width: 1,
                                height: wickHeight,
                                backgroundColor: color,
                                opacity: 0.8,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                left: x,
                                top: top,
                                width: candleWidth,
                                height: height,
                                backgroundColor: color,
                            }}
                        />
                    </React.Fragment>
                );
            })}

            {/* Volume Bars */}
            {ohlcData.map((d, i) => {
                const isUp = d.close >= d.open;
                const color = isUp ? COLORS.upVol : COLORS.downVol;
                const x = margin.left + i * candleGap;
                const top = scaleVol(d.volume);
                const height = volumeHeight - (top - volumeTop);

                return (
                    <div
                        key={`v-${i}`}
                        style={{
                            position: "absolute",
                            left: x,
                            top,
                            width: candleWidth,
                            height: Math.max(0, height),
                            backgroundColor: color,
                        }}
                    />
                );
            })}

            {/* X-Axis Labels */}
            {xLabels.map(({ d, i }) => (
                <div
                    key={`x-${i}`}
                    style={{
                        position: "absolute",
                        left: margin.left + i * candleGap,
                        top: height - margin.bottom + 8,
                        width: 80,
                        marginLeft: -40,
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
                        {formatXAxisLabel(d.timestamp, timeRangeMs)}
                    </span>
                </div>
            ))}

            {/* Chart Borders */}
            <div
                style={{
                    position: "absolute",
                    left: margin.left,
                    top: priceTop,
                    width: contentWidth,
                    height: priceHeight,
                    border: `1px solid ${COLORS.border}`,
                    pointerEvents: "none",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: margin.left,
                    top: volumeTop,
                    width: contentWidth,
                    height: volumeHeight,
                    border: `1px solid ${COLORS.border}`,
                    pointerEvents: "none",
                }}
            />
        </div>
    );
}

// ============================================
// Main Export Function (signature unchanged)
// ============================================

/**
 * Generates a candlestick chart image as a PNG buffer.
 *
 * @param ohlcData - Array of OHLC data points
 * @param assetSymbol - The asset symbol (e.g., "BTC", "AAPL")
 * @param intervalLabel - The time interval (e.g., "1H", "1D")
 * @param extraInfo - Additional info like latest OHLC and change%
 * @param _darkMode - Deprecated, always uses dark mode
 * @returns PNG image buffer
 */
export async function generateCandlestickChart(
    ohlcData: OhlcData[],
    assetSymbol: string,
    intervalLabel: string,
    extraInfo: ChartExtraInfo,
    _darkMode = true
): Promise<Buffer> {
    const response = new ImageResponse(
        <CandlestickChart
            ohlcData={ohlcData}
            assetSymbol={assetSymbol}
            intervalLabel={intervalLabel}
            extraInfo={extraInfo}
        />,
        {
            width: DIMENSIONS.width,
            height: DIMENSIONS.height,
            format: "png",
        }
    );

    return Buffer.from(await response.arrayBuffer());
}
