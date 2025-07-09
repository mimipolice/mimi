const { rarityColors, rarityIcons } = require("./config");
const { sortUserStats } = require("./utils");

const rarityFullNames = {
  EX: "Extra Rare / Extreme Rare (額外稀有 / 極限稀有)",
  LR: "Legendary Rare (傳說稀有)",
  UR: "Ultra Rare (極度稀有)",
  SSR: "Super Super Rare (超級稀有)",
};

function parseDiscordEmoji(emoji) {
  const match = emoji.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return emoji;
  const isAnimated = emoji.startsWith("<a:");
  const name = match[1];
  const id = match[2];
  const ext = isAnimated ? "gif" : "png";
  return `<img src=\"https://cdn.discordapp.com/emojis/${id}.${ext}\" alt=\"${name}\" class=\"inline w-7 h-7 align-middle\">`;
}

function generateHTML(userStats, title = "歐狗榜", watermarkImage = null) {
  const users = sortUserStats(userStats);
  const currentTime = new Date().toLocaleString("zh-TW");

  // 水印圖片 HTML
  let watermarkHTML = "";
  if (watermarkImage) {
    watermarkHTML = `
      <img src="${watermarkImage}" alt="watermark" style="position:absolute; left:32px; bottom:32px; width:300px; opacity:0.15; pointer-events:none; z-index:1;" />
    `;
  }

  return `
<!DOCTYPE html>
<html lang="zh-TW" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@4.4.20/dist/full.min.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: linear-gradient(135deg, #1e1e2f 0%, #2c2c3a 100%);
            font-family: 'Microsoft JhengHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
        }
        .glass-effect {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .rarity-glow {
            text-shadow: 0 0 10px currentColor;
        }
        .rank-1 { background: linear-gradient(135deg, #e74c3c, #c0392b); }
        .rank-2 { background: linear-gradient(135deg, #f39c12, #e67e22); }
        .rank-3 { background: linear-gradient(135deg, #f1c40f, #f39c12); }
        .crown {
            animation: crown-glow 2s ease-in-out infinite alternate;
        }
        @keyframes crown-glow {
            from { filter: drop-shadow(0 0 5px #ffd700); }
            to { filter: drop-shadow(0 0 15px #ffd700); }
        }
        .stats-card {
            transition: all 0.3s ease;
        }
        .stats-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
    </style>
</head>
<body class="min-h-screen p-4 relative">
    <div class="w-full flex flex-col items-center">
        <h1 class="text-4xl font-bold text-white mb-2 text-center">${title}</h1>
        <div class="badge badge-primary mt-2">${currentTime}</div>
        <p class="text-gray-300 mt-2">共 ${users.length} 名參與者</p>
        <div class="flex flex-row gap-8 items-stretch min-w-fit mt-8">
            <div class="flex-shrink-0" style="width:1200px;">${generateStatsCards(
              userStats,
              users
            )}</div>
            <div class="flex-1 min-w-0" style="width:1200px;max-width:1200px;">${generateDetailedTable(
              userStats,
              users
            )}</div>
        </div>
        <!--
        <div class="glass-effect rounded-xl p-6 mt-6 w-auto max-w-[1932px] mx-auto">
            <h3 class="text-xl font-bold text-white mb-4">稀有度說明</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                ${generateLegend()}
            </div>
            <div class="mt-2 text-sm text-gray-400 grid grid-cols-2 md:grid-cols-4 gap-4">
                ${Object.entries(rarityFullNames)
                  .map(
                    ([rarity, desc]) =>
                      `<div><span class='font-bold' style='color:${rarityColors[rarity]}'>${rarity}</span>: ${desc}</div>`
                  )
                  .join("")}
            </div>
        </div>
        -->
        ${watermarkHTML}
    </div>
</body>
</html>
  `;
}

function generateStatsCards(userStats, users) {
  return `
    <div class="grid grid-cols-2 gap-8">
      ${users
        .slice(0, 10)
        .map((user, index) => {
          const stats = userStats[user];
          const total =
            (stats.EX || 0) +
            (stats.LR || 0) +
            (stats.UR || 0) +
            (stats.SSR || 0);
          const rankClass = index < 3 ? `rank-${index + 1}` : "bg-base-200";
          const crownIcon =
            index === 0 ? '<span class="crown text-2xl">👑</span>' : "";
          return `
          <div class="stats-card glass-effect rounded-xl p-6 mb-2 ${rankClass}" style="width:584px;">
              <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                      <div class="text-2xl font-bold text-white">#${
                        index + 1
                      }</div>
                      ${crownIcon}
                  </div>
                  <div class="text-right">
                      <div class="text-lg font-bold text-white">${user}</div>
                      <div class="text-sm text-gray-300">總計: ${total}</div>
                  </div>
              </div>
              <div class="grid grid-cols-4 gap-2">
                  ${Object.entries(rarityIcons)
                    .map(([rarity, icon]) => {
                      const count = stats[rarity] || 0;
                      const color = rarityColors[rarity];
                      const iconHTML = parseDiscordEmoji(icon);
                      return `
                      <div class="text-center p-2 rounded-lg ${
                        count > 0 ? "bg-base-300" : "bg-gray-800 opacity-60"
                      }">
                          <div class="text-lg">${iconHTML}</div>
                          <div class="text-sm font-bold rarity-glow ${
                            count === 0 ? "text-gray-400" : ""
                          }" style="color: ${color}">${count}</div>
                          <div class="text-xs ${
                            count === 0 ? "text-gray-500" : "text-gray-400"
                          }">${rarity}</div>
                      </div>
                    `;
                    })
                    .join("")}
              </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

function generateDetailedTable(userStats, users) {
  return `
    <div class="glass-effect rounded-xl p-6">
        <h2 class="text-2xl font-bold text-white mb-4">詳細排行榜</h2>
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr class="bg-base-300">
                        <th class="text-center">排名</th>
                        <th>使用者</th>
                        <th class="text-center">EX</th>
                        <th class="text-center">LR</th>
                        <th class="text-center">UR</th>
                        <th class="text-center">SSR</th>
                        <th class="text-center">總計</th>
                    </tr>
                </thead>
                <tbody>
                    ${users
                      .map((user, index) => {
                        const stats = userStats[user];
                        const total =
                          (stats.EX || 0) +
                          (stats.LR || 0) +
                          (stats.UR || 0) +
                          (stats.SSR || 0);
                        const rankIcon =
                          index === 0
                            ? "👑"
                            : index === 1
                            ? "🥈"
                            : index === 2
                            ? "🥉"
                            : "";
                        return `
                          <tr class="hover:bg-base-200">
                              <td class="text-center font-bold">
                                  ${rankIcon} ${index + 1}
                              </td>
                              <td class="font-medium">${user}</td>
                              ${Object.entries(rarityColors)
                                .map(([rarity, color]) => {
                                  const count = stats[rarity] || 0;
                                  return `
                                    <td class="text-center">
                                        <span class="font-bold rarity-glow ${
                                          count === 0 ? "text-gray-400" : ""
                                        }" style="color: ${color}">${count}</span>
                                    </td>
                                  `;
                                })
                                .join("")}
                              <td class="text-center font-bold text-white">${total}</td>
                          </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    </div>
  `;
}

function generateLegend() {
  return Object.entries(rarityColors)
    .map(([rarity, color]) => {
      const iconHTML = parseDiscordEmoji(rarityIcons[rarity]);
      return `
    <div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
        <div class="text-2xl">${iconHTML}</div>
        <div>
            <div class="font-bold rarity-glow" style="color: ${color}">${rarity}</div>
            <div class="text-sm text-gray-400">最高稀有度</div>
        </div>
    </div>
  `;
    })
    .join("");
}

module.exports = {
  generateHTML,
};
