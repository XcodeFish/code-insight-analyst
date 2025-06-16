import { IAnalysisResult } from '../types/analysis';
import { HTMLReportGenerator } from './formatters/html';
import { JSONReportGenerator } from './formatters/json';
import { ConsoleReportGenerator } from './formatters/console';
import { IReportOptions } from '../types/report';

export type ReportFormat = 'html' | 'json' | 'console';

/**
 * 报告生成器工厂
 * 根据指定格式创建相应的报告生成器
 */
export class ReportGeneratorFactory {
  /**
   * 创建报告生成器实例
   * @param format 报告格式
   * @param options 报告选项
   * @returns 报告生成器实例
   */
  static create(format: ReportFormat, options: IReportOptions = {}) {
    switch (format) {
      case 'html':
        return new HTMLReportGenerator(options);
      case 'json':
        return new JSONReportGenerator(options);
      case 'console':
      default:
        return new ConsoleReportGenerator(options);
    }
  }

  /**
   * 生成多种格式的报告
   * @param results 分析结果
   * @param formats 需要生成的报告格式
   * @param options 报告选项
   * @returns 生成的报告文件路径
   */
  static async generateReports(
    results: IAnalysisResult,
    formats: ReportFormat[] = ['html', 'console'],
    options: IReportOptions = {}
  ): Promise<string[]> {
    const reportPaths: string[] = [];

    for (const format of formats) {
      const generator = this.create(format, options);
      const reportPath = await generator.generate(results);
      if (reportPath) {
        reportPaths.push(reportPath);
      }
    }

    return reportPaths;
  }
}

export * from './formatters/base';
