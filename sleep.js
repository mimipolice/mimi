const dayjs = require("dayjs");
const fs = require("fs");
const SLEEP_DATA_PATH = "./sleepData.json";

function loadSleepData() {
  if (!fs.existsSync(SLEEP_DATA_PATH))
    return { isTracking: false, startTime: null, data: [] };
  try {
    const data = JSON.parse(fs.readFileSync(SLEEP_DATA_PATH, "utf8"));
    return {
      ...data,
      startTime: data.startTime ? dayjs(data.startTime) : null,
      data: data.data.map((item) => ({ ...item, time: dayjs(item.time) })),
    };
  } catch (e) {
    console.error("❌ 無法讀取 sleepData.json", e);
    return { isTracking: false, startTime: null, data: [] };
  }
}

function saveSleepData(sleepData) {
  fs.writeFileSync(
    SLEEP_DATA_PATH,
    JSON.stringify(
      {
        isTracking: sleepData.isTracking,
        startTime: sleepData.startTime
          ? sleepData.startTime.toISOString()
          : null,
        data: sleepData.data.map((item) => ({
          time: item.time.toISOString(),
          symbol: item.symbol,
          name: item.name,
          price: item.price,
          changePercent: item.changePercent,
          volume: item.volume,
        })),
      },
      null,
      2
    )
  );
}

function startSleepTracking() {
  const sleepData = {
    isTracking: true,
    startTime: dayjs(),
    data: [],
  };
  saveSleepData(sleepData);
  console.log("🛏️ 開始睡眠追蹤");
}

function stopSleepTracking() {
  const sleepData = loadSleepData();
  if (!sleepData.isTracking) return null;

  const endTime = dayjs();
  const trackingData = {
    startTime: sleepData.startTime,
    endTime: endTime,
    data: [...sleepData.data],
  };

  const newSleepData = { isTracking: false, startTime: null, data: [] };
  saveSleepData(newSleepData);

  console.log("⏰ 結束睡眠追蹤");
  return trackingData;
}

function addAllStocksToSleepTracking(stocks, time) {
  const sleepData = loadSleepData();
  if (sleepData.isTracking) {
    stocks.forEach((stock) => {
      sleepData.data.push({ time, ...stock });
    });
    saveSleepData(sleepData);
  }
}

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
      highIndex !== -1 && data[highIndex] ? data[highIndex].time : null;
    const lowTime =
      lowIndex !== -1 && data[lowIndex] ? data[lowIndex].time : null;
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
  loadSleepData,
  saveSleepData,
  startSleepTracking,
  stopSleepTracking,
  addAllStocksToSleepTracking,
  analyzeSleepData,
};
