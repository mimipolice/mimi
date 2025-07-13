import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { ChartConfiguration } from "chart.js";
import "chartjs-adapter-date-fns";

const width = 800;
const height = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour: "white",
});

export async function generatePriceChart(
  data: { timestamp: Date; price: number }[]
): Promise<Buffer> {
  const configuration: ChartConfiguration = {
    type: "line",
    data: {
      datasets: [
        {
          label: "Price",
          data: data.map((d) => ({ x: d.timestamp.getTime(), y: d.price })),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
      ],
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
          },
        },
        y: {
          beginAtZero: false,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  };

  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return buffer;
}
