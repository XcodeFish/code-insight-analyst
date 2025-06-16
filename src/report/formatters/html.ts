import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as ejs from 'ejs';

import { BaseReportGenerator } from './base';
import { IAnalysisResult } from '../../types/analysis';
import { IReportOptions } from '../../types/report';
import { ChartVisualizer } from '../visualizers/chart-visualizer';

/**
 * HTML报告生成器
 */
export class HTMLReportGenerator extends BaseReportGenerator {
  private defaultTemplatePath: string;

  constructor(options: IReportOptions = {}) {
    super(options);
    this.defaultTemplatePath = path.join(
      __dirname,
      '../templates/html-report.ejs'
    );
  }

  /**
   * 生成HTML报告
   * @param results 分析结果
   * @returns 报告文件路径
   */
  async generate(results: IAnalysisResult): Promise<string | null> {
    try {
      await this.ensureOutputDir();

      const templatePath =
        this.options.templatePath || this.defaultTemplatePath;
      const chartData = this.prepareChartData(results);
      const fileName = this.getReportFileName('html');
      const outputPath = this.getReportPath(fileName);

      const templateContent = await fsPromises.readFile(templatePath, 'utf-8');

      // 使用可视化器为图表生成HTML内容
      const chartsHtml = ChartVisualizer.wrapChartsInContainer(chartData);

      const htmlContent = await ejs.render(
        templateContent,
        {
          title: this.options.title || '代码分析报告',
          projectName: results.projectName,
          timestamp: this.formatDateTime(this.options.timestamp || new Date()),
          results,
          chartData: JSON.stringify(chartData),
          chartsHtml,
          detailed: this.options.detailed,
          duration: this.formatDuration(results.stats.duration),
        },
        { async: true }
      );

      await fsPromises.writeFile(outputPath, htmlContent);

      return outputPath;
    } catch (error) {
      console.error('生成HTML报告失败:', error);
      return null;
    }
  }
}
