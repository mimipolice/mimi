const dayjs = require("dayjs");

function analyzeSleepData(trackingData) {
  if (
    !trackingData ||
    !Array.isArray(trackingData.data) ||
    trackingData.data.length === 0
  ) {
    return [{ error: "沒有足夠的數據進行分析" }];
  }
  const grouped = {};
  trackingData.data.forEach((d) => {
    if (!d.symbol) return;
    if (!grouped[d.symbol]) grouped[d.symbol] = { name: d.name, data: [] };
    grouped[d.symbol].data.push(d);
  });
  return Object.entries(grouped).map(([symbol, group]) => {
    const data = group.data
      .map((d) => ({ ...d, time: dayjs(d.time) }))
      .sort((a, b) => a.time.valueOf() - b.time.valueOf());
    if (!Array.isArray(data) || data.length === 0)
      return { error: `股票 ${symbol} 沒有數據` };
    const prices = data.map((d) => d.price);
    const startPrice = data[0].price;
    const endPrice = data[data.length - 1].price;
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);
    const totalChange = endPrice - startPrice;
    const totalChangePercent = (totalChange / startPrice) * 100;
    const highChangePercent = ((highPrice - startPrice) / startPrice) * 100;
    const lowChangePercent = ((lowPrice - startPrice) / startPrice) * 100;
    const volatility = highPrice - lowPrice;
    const volatilityPercent = (volatility / startPrice) * 100;
    const avgPrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const highIndex = data.findIndex((d) => d.price === highPrice);
    const lowIndex = data.findIndex((d) => d.price === lowPrice);
    const highTime =
      highIndex !== -1 && data[highIndex]
        ? data[highIndex].time
        : data.length > 0
        ? data[0].time
        : null;
    const lowTime =
      lowIndex !== -1 && data[lowIndex]
        ? data[lowIndex].time
        : data.length > 0
        ? data[data.length - 1].time
        : null;
    const sleepDuration = trackingData.endTime.diff(
      trackingData.startTime,
      "hour",
      true
    );
    // 安全處理數字
    function safeFixed(val, digits = 2, fallback = "-") {
      return typeof val === "number" && isFinite(val)
        ? val.toFixed(digits)
        : fallback;
    }
    return {
      symbol,
      name: group.name,
      startTime: trackingData.startTime.format("YYYY-MM-DD HH:mm:ss"),
      endTime: trackingData.endTime.format("YYYY-MM-DD HH:mm:ss"),
      sleepDuration: safeFixed(sleepDuration, 1),
      startPrice: safeFixed(startPrice),
      endPrice: safeFixed(endPrice),
      highPrice: safeFixed(highPrice),
      lowPrice: safeFixed(lowPrice),
      totalChange: safeFixed(totalChange),
      totalChangePercent: safeFixed(totalChangePercent),
      highChangePercent: safeFixed(highChangePercent),
      lowChangePercent: safeFixed(lowChangePercent),
      highDateTime: highTime ? highTime.format("YYYY-MM-DD HH:mm:ss") : "-",
      lowDateTime: lowTime ? lowTime.format("YYYY-MM-DD HH:mm:ss") : "-",
      volatility: safeFixed(volatility),
      volatilityPercent: safeFixed(volatilityPercent),
      avgPrice: safeFixed(avgPrice),
      highTime: highTime ? highTime.format("HH:mm:ss") : "-",
      lowTime: lowTime ? lowTime.format("HH:mm:ss") : "-",
      dataPoints: data.length,
      priceData: data,
    };
  });
}

module.exports = {
  analyzeSleepData,
};
