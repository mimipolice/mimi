import { createCanvas } from "canvas";
import {
  Chart,
  ChartConfiguration,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale,
  LineController,
  BarController,
} from "chart.js";
import "chartjs-adapter-moment";

// Register all the necessary components with Chart.js
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale,
  LineController,
  BarController
);

// Define interfaces for the data
interface PriceData {
  timestamp: Date;
  price: number;
  volume: number;
}

export async function generatePriceChart(
  priceData: PriceData[],
  darkMode = false
): Promise<Buffer> {
  const width = 1600;
  const height = 800;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Manually set background color
  ctx.fillStyle = darkMode ? "#1E293B" : "white";
  ctx.fillRect(0, 0, width, height);

  const configuration: ChartConfiguration = {
    type: "line",
    data: {
      datasets: [
        {
          label: "Price",
          data: priceData.map((d) => ({
            x: d.timestamp.getTime(),
            y: d.price,
          })),
          borderColor: darkMode ? "rgba(54, 162, 235, 1)" : "rgb(75, 192, 192)",
          tension: 0.1,
          yAxisID: "y",
        },
        {
          label: "Volume",
          data: priceData.map((d) => ({
            x: d.timestamp.getTime(),
            y: d.volume,
          })),
          backgroundColor: darkMode
            ? "rgba(255, 99, 132, 0.5)"
            : "rgba(153, 102, 255, 0.2)",
          type: "bar",
          yAxisID: "y1",
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
          ticks: {
            color: darkMode ? "white" : "black",
            font: {
              size: 18,
            },
          },
          grid: {
            color: darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          beginAtZero: false,
          ticks: {
            color: darkMode ? "white" : "black",
            font: {
              size: 18,
            },
          },
          grid: {
            color: darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          grid: {
            drawOnChartArea: false, // only want the grid lines for one axis to show up
          },
          ticks: {
            color: darkMode ? "white" : "black",
            font: {
              size: 18,
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: darkMode ? "white" : "black",
            font: {
              size: 20,
            },
          },
        },
      },
      elements: {
        point: {
          radius: 4,
        },
        line: {
          borderWidth: 3,
        },
      },
    },
  };

  new Chart(canvas as any, configuration);

  return canvas.toBuffer("image/png");
}
