import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import "./LineChart.css";

/**
 * Responsive minimalistic line chart.
 */
export function LineChart({
                            labels,
                            values,
                            color = '#3b82f6',
                            datasetLabel,
                            formatAverageLabel,
                            showAverage = true,
                            secondValues,
                            secondColor = '#e58a3d',
                            secondDatasetLabel,
                            className = '',
                          }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const hasSecond = Array.isArray(secondValues);

  useEffect(() => {
    if (!canvasRef.current) return;

    const logged = values.filter(v => v != null);

    const average =
        logged.length > 0
            ? logged.reduce((sum, value) => sum + value, 0) / logged.length
            : null;

    chartRef.current?.destroy();

    const datasets = [
      {
        label: datasetLabel,
        data: values,

        borderColor: color,
        backgroundColor: color,

        borderWidth: 3,
        tension: 0.35,

        pointRadius: 3,
        pointHoverRadius: 5,

        pointBackgroundColor: color,
        pointBorderWidth: 0,

        fill: false,
        spanGaps: true,
        yAxisID: 'y',
      },
    ];

    if (showAverage) {
      datasets.push({
        label:
            average != null
                ? formatAverageLabel(average)
                : 'Average',

        data: values.map(() => average),

        borderColor: 'rgba(255,255,255,.25)',
        borderDash: [4, 4],
        borderWidth: 1,

        pointRadius: 0,
        fill: false,
        yAxisID: 'y',
      });
    }

    if (hasSecond) {
      datasets.push({
        label: secondDatasetLabel,
        data: secondValues,

        borderColor: secondColor,
        backgroundColor: secondColor,

        borderWidth: 3,
        tension: 0.35,

        pointRadius: 1,
        pointHoverRadius: 2,

        pointBackgroundColor: secondColor,
        pointBorderWidth: 0,

        fill: false,
        spanGaps: true,
        yAxisID: 'y1',
      });
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',

      data: {
        labels,

        datasets,
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false,
        },

        layout: {
          padding: 8,
        },

        plugins: {
          legend: {
            display: window.innerWidth >= 768,
            labels: {
              color: '#9ca3af',
              boxWidth: 12,
              usePointStyle: true,
            },
          },

          tooltip: {
            displayColors: false,
            backgroundColor: '#1f1f1f',
            borderColor: '#333',
            borderWidth: 1,
            padding: 12,

            titleColor: '#fff',
            bodyColor: '#ddd',

            cornerRadius: 10,
          },
        },

        scales: {
          x: {
            grid: {
              display: false,
            },

            border: {
              display: false,
            },

            ticks: {
              color: '#8b8b8b',
              autoSkip: true,
              maxTicksLimit: 6,

              maxRotation: 45,
              minRotation: 45,
            },
          },

          y: {
            beginAtZero: false,

            grid: {
              color: 'rgba(255,255,255,.04)',
              drawBorder: false,
            },

            border: {
              display: false,
            },

            ticks: {
              color: '#8b8b8b',
              maxTicksLimit: 5,
            },
          },

          ...(hasSecond
              ? {
                y1: {
                  beginAtZero: false,
                  position: 'right',

                  grid: {
                    display: false,
                  },

                  border: {
                    display: false,
                  },

                  ticks: {
                    color: '#8b8b8b',
                    maxTicksLimit: 5,
                  },
                },
              }
              : {}),
        },

        animation: {
          duration: 500,
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, values, color, datasetLabel, formatAverageLabel, showAverage, hasSecond, secondValues, secondColor, secondDatasetLabel]);

  return (
      <div className={`chart-wrap ${className}`.trim()}>
        <canvas ref={canvasRef} />
      </div>
  );
}
