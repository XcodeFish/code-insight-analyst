import { IChartData } from '../../types/report';

/**
 * 图表可视化器类
 * 用于生成Chart.js配置和选项
 */
export class ChartVisualizer {
  /**
   * 生成Chart.js配置
   * @param chartData 图表数据
   * @returns Chart.js配置对象
   */
  static generateChartConfig(chartData: IChartData): any {
    const config: any = {
      type: chartData.type,
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title,
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: chartData.type !== 'bar' || chartData.datasets.length > 1,
            position: 'bottom',
          },
          datalabels: {
            display: true,
            color: '#333',
            font: {
              weight: 'bold',
            },
            formatter: (value: number) => {
              return chartData.type === 'pie' || chartData.type === 'doughnut'
                ? `${value.toFixed(1)}%`
                : value.toFixed(1);
            },
            anchor: 'end',
            align: 'end',
          },
          tooltip: {
            enabled: true,
          },
        },
      },
    };

    // 根据图表类型设置特定选项
    switch (chartData.type) {
      case 'bar':
        config.options.scales = {
          y: {
            beginAtZero: true,
          },
        };
        break;
      case 'pie':
      case 'doughnut':
        config.options.cutout = chartData.type === 'doughnut' ? '50%' : 0;
        break;
    }

    return config;
  }

  /**
   * 生成HTML内容初始化图表
   * @param chartData 图表数据列表
   * @returns 包含初始化脚本的HTML字符串
   */
  static generateChartInitScript(chartData: IChartData[]): string {
    let script = `
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // 注册数据标签插件
        Chart.register(ChartDataLabels);
    `;

    // 为每个图表生成初始化代码
    chartData.forEach((chart, index) => {
      script += `
        // 初始化 ${chart.title} 图表
        (function() {
          const ctx = document.getElementById('chart-${index}').getContext('2d');
          const config = ${JSON.stringify(this.generateChartConfig(chart))};
          new Chart(ctx, config);
        })();
      `;
    });

    script += `
      });
    </script>
    `;

    return script;
  }

  /**
   * 生成图表HTML容器
   * @param index 图表索引
   * @param chartData 图表数据
   * @returns 图表容器HTML
   */
  static generateChartContainer(index: number, chartData: IChartData): string {
    return `
    <div class="chart-container">
      <div class="chart-header">
        <h2>${chartData.title}</h2>
      </div>
      <div class="chart-canvas-container">
        <canvas id="chart-${index}" class="chart-canvas"></canvas>
      </div>
    </div>
    `;
  }

  /**
   * 将所有图表包装在一个容器中
   * @param chartData 图表数据列表
   * @returns 包含所有图表的HTML
   */
  static wrapChartsInContainer(chartData: IChartData[]): string {
    if (chartData.length === 0) {
      return '';
    }

    const chartRows = this.arrangeChartsInRows(chartData);

    return `
    <div class="charts-section">
      <h2 class="section-title">分析图表可视化</h2>
      ${chartRows}
    </div>
    ${this.generateChartInitScript(chartData)}
    `;
  }

  /**
   * 将图表排列成行
   * @param chartData 图表数据列表
   * @param chartsPerRow 每行图表数量
   * @returns 排列后的HTML
   */
  private static arrangeChartsInRows(
    chartData: IChartData[],
    chartsPerRow: number = 2
  ): string {
    let html = '';
    for (let i = 0; i < chartData.length; i += chartsPerRow) {
      html += '<div class="chart-row">';
      for (let j = i; j < i + chartsPerRow && j < chartData.length; j++) {
        html += this.generateChartContainer(j, chartData[j]);
      }
      html += '</div>';
    }
    return html;
  }
}
