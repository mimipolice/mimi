# TASK-001: 将图片生成从 Canvas + Chart.js 迁移至 Takumi

## 任务概述

| 属性 | 值 |
|------|-----|
| **任务 ID** | TASK-001 |
| **类型** | 重构 (Refactoring) |
| **优先级** | Medium |
| **影响范围** | 股票/价格报告功能 |
| **相关功能** | `/report` 命令、快速报告按钮、股票选择菜单 |

## 背景

当前项目使用 `canvas` (node-canvas) + `Chart.js` 手动绘制 K 线图。代码量约 330+ 行，包含大量命令式 Canvas API 调用和自定义 Chart.js 插件，维护成本高。

[Takumi](https://github.com/kane50613/takumi) 是一个基于 Rust 的 JSX 图片渲染引擎，支持声明式 JSX 模板和 Tailwind CSS，可大幅简化图片生成代码。

---

## 目标

1. 使用 `@takumi-rs/image-response` 替换现有 `canvas` + `chart.js` 方案
2. 保持现有 K 线图视觉效果一致
3. 减少代码复杂度，提升可维护性
4. 利用 Tailwind CSS 统一样式管理

---

## 现有实现分析

### 核心文件

| 文件路径 | 说明 |
|----------|------|
| `src/utils/chart-generator.ts` | 核心图片生成逻辑 (334 行) |
| `src/services/ChartCacheService.ts` | 图片缓存服务 (67 行) |
| `src/utils/index.ts:35` | 导出 `generateCandlestickChart` |

### 调用点 (共 4 处)

| 文件路径 | 行号 | 使用场景 |
|----------|------|----------|
| `src/commands/public/report/index.ts` | ~412 | `/report` 命令主入口 |
| `src/interactions/buttons/reportQuick.ts` | ~85 | 快速报告按钮 |
| `src/interactions/selectMenus/stockSelect.ts` | ~94 | 股票选择菜单 |
| `tests/unit/utils/chart-generator.test.ts` | - | 单元测试 |

### 现有函数签名

```typescript
// src/utils/chart-generator.ts

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

export async function generateCandlestickChart(
  ohlcData: OhlcData[],
  assetSymbol: string,
  intervalLabel: string,
  extraInfo: ChartExtraInfo,
  darkMode = true
): Promise<Buffer>
```

### 现有依赖 (待移除)

```json
{
  "canvas": "^3.1.2",
  "chart.js": "^4.5.0",
  "chartjs-adapter-moment": "^1.0.1",
  "chartjs-node-canvas": "^5.0.0",
  "chartjs-plugin-annotation": "^3.1.0"
}
```

---

## Takumi API 概览

### 安装

```bash
npm i @takumi-rs/image-response
```

### 基本用法

```tsx
/** @jsxImportSource react */
import { ImageResponse } from "@takumi-rs/image-response";

// 生成图片
const response = new ImageResponse(<MyComponent />, {
  width: 900,
  height: 506,
  format: "png",  // 可选: "png" | "jpeg" | "webp"
});

// 获取 Buffer
const buffer = Buffer.from(await response.arrayBuffer());
```

### Tailwind CSS 支持

```tsx
function Hello() {
  return (
    <div tw="bg-slate-800 w-full h-full flex items-center justify-center">
      <h1 tw="text-4xl font-bold text-white">Hello</h1>
    </div>
  );
}
```

### 自定义字体

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fontData = await readFile(join(process.cwd(), "assets/Inter-SemiBold.ttf"));

new ImageResponse(<Component />, {
  width: 900,
  height: 506,
  fonts: [
    {
      name: "Inter",
      data: fontData,
      weight: 600,
      style: "normal",
    },
  ],
});
```

---

## 实施步骤

### Phase 1: 环境准备

- [x] **1.1** 安装 takumi 依赖
  ```bash
  npm i @takumi-rs/image-response
  ```

- [x] **1.2** 配置 TypeScript JSX 支持
  - 确认 `tsconfig.json` 中 `jsx` 设置为 `react-jsx` 或 `react`
  - 若项目无 React，需安装 `@types/react` 作为 devDependency

- [x] **1.3** 准备字体文件 (可选)
  - 如需自定义字体，将 `.ttf` / `.woff2` 文件放入 `assets/fonts/`

### Phase 2: 创建新图表组件

- [x] **2.1** 创建 `src/utils/chart-generator-takumi.tsx`
  - 使用 JSX 重新实现 K 线图布局

- [x] **2.2** 实现以下视觉元素:
  | 元素 | 说明 |
  |------|------|
  | 标题栏 | `{SYMBOL} • {INTERVAL}` |
  | OHLC 信息 | `O: H: L: C:` 带颜色标签 |
  | 涨跌幅 | 右侧显示，红/绿色 |
  | K 线图区域 | 蜡烛图 + 成交量 |
  | Y 轴标签 | 价格 / 成交量 |
  | X 轴标签 | 时间刻度 |

- [x] **2.3** K 线绘制逻辑 (核心)
  ```tsx
  // 伪代码 - 单根蜡烛
  interface CandleProps {
    x: number;
    open: number;
    high: number;
    low: number;
    close: number;
    width: number;
    scaleY: (price: number) => number;
  }

  function Candle({ x, open, high, low, close, width, scaleY }: CandleProps) {
    const isUp = close >= open;
    const color = isUp ? "#22c55e" : "#ef4444";
    const bodyTop = scaleY(Math.max(open, close));
    const bodyHeight = Math.abs(scaleY(open) - scaleY(close));
    const wickTop = scaleY(high);
    const wickBottom = scaleY(low);

    return (
      <div style={{ position: "absolute", left: x }}>
        {/* Wick (影线) */}
        <div
          style={{
            position: "absolute",
            left: width / 2 - 1,
            top: wickTop,
            width: 2,
            height: wickBottom - wickTop,
            backgroundColor: color,
          }}
        />
        {/* Body (实体) */}
        <div
          style={{
            position: "absolute",
            top: bodyTop,
            width: width,
            height: Math.max(bodyHeight, 1),
            backgroundColor: color,
          }}
        />
      </div>
    );
  }
  ```

### Phase 3: 集成与替换

- [x] **3.1** 更新 `src/utils/chart-generator.ts`
  - 将原有逻辑替换为调用新 takumi 组件
  - 保持函数签名不变，确保向后兼容

- [x] **3.2** 更新 `src/utils/index.ts` 导出 (若有变更)

- [x] **3.3** 验证所有调用点正常工作
  - `src/commands/public/report/index.ts`
  - `src/interactions/buttons/reportQuick.ts`
  - `src/interactions/selectMenus/stockSelect.ts`

### Phase 4: 测试

- [x] **4.1** 更新单元测试
  - 修改 `tests/unit/utils/chart-generator.test.ts`
  - 测试新组件的纯逻辑函数 (颜色计算、坐标转换等)

- [x] **4.2** 视觉回归测试
  - 生成新旧两版图片进行对比
  - 确保视觉效果一致

- [x] **4.3** 运行完整测试套件
  ```bash
  npm test
  ```

### Phase 5: 清理

- [x] **5.1** 移除旧依赖
  ```bash
  npm uninstall canvas chart.js chartjs-adapter-moment chartjs-node-canvas chartjs-plugin-annotation
  ```

- [x] **5.2** 删除废弃代码 (确认无其他使用后)

- [x] **5.3** 更新文档
  - 更新 `CLAUDE.md` 中的技术栈描述

---

## 新组件架构参考

```
src/utils/
├── chart-generator.ts              # 主入口 (保持签名不变)
└── chart-components/               # 新增目录
    ├── CandlestickChart.tsx        # 主图表组件
    ├── Candle.tsx                  # 单根蜡烛组件
    ├── VolumeBar.tsx               # 成交量柱组件
    ├── PriceAxis.tsx               # Y轴价格标签
    ├── TimeAxis.tsx                # X轴时间标签
    ├── ChartHeader.tsx             # 顶部标题 + OHLC
    └── utils.ts                    # 坐标转换、格式化函数
```

---

## 颜色规范 (保持一致)

| 用途 | 颜色值 |
|------|--------|
| 上涨 (bullish) | `#22c55e` (Tailwind: `green-500`) |
| 下跌 (bearish) | `#ef4444` (Tailwind: `red-500`) |
| 背景 (dark) | `#1E293B` (Tailwind: `slate-800`) |
| 主文字 | `rgba(255, 255, 255, 0.9)` |
| 次要文字 | `rgba(255, 255, 255, 0.6)` |
| OHLC 标签 | `#facc15` (Tailwind: `yellow-400`) |
| 网格线 | `rgba(255, 255, 255, 0.1)` |

---

## 尺寸规范

| 属性 | 值 |
|------|-----|
| 图片宽度 | 900px |
| 图片高度 | 506.25px (16:9) |
| 顶部 padding (标题区) | 100px |
| 左右 padding | 50px |
| 标题字号 | 28px bold |
| OHLC 字号 | 22px |
| 轴标签字号 | 14px |

---

## 风险与注意事项

### 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Takumi 项目较新 | 可能有未知 bug | 充分测试；保留回滚能力 |
| Native 依赖编译 | 部署环境兼容性 | 测试 Linux/Docker 环境 |
| K 线图需自行实现 | 开发工作量 | 参考现有代码逻辑；可迭代优化 |

### 向后兼容

- **必须**保持 `generateCandlestickChart` 函数签名不变
- **必须**保持返回值类型为 `Promise<Buffer>`
- **必须**保持视觉效果一致 (至少功能性一致)

### 回滚方案

若迁移失败，可通过以下步骤回滚:
1. 恢复 `src/utils/chart-generator.ts` 原始版本
2. 重新安装旧依赖: `npm i canvas chart.js chartjs-adapter-moment chartjs-node-canvas`
3. 移除 takumi: `npm uninstall @takumi-rs/image-response`

---

## 验收标准

- [x] `/report` 命令正常生成 K 线图
- [x] 快速报告按钮正常工作
- [x] 股票选择菜单正常切换并生成图表
- [x] 所有单元测试通过
- [x] 图片视觉效果与原版基本一致
- [x] 无 `canvas`, `chart.js` 相关依赖残留
- [x] 代码行数明显减少 (目标: < 200 行)
