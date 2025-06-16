import { promises as fsPromises } from 'fs';

import { BaseReportGenerator } from './base';
import { IAnalysisResult } from '../../types/analysis';
import { IReportOptions } from '../../types/report';

/**
 * JSON报告生成器
 */
export class JSONReportGenerator extends BaseReportGenerator {
  constructor(options: IReportOptions = {}) {
    super(options);
  }

  /**
   * 生成JSON报告
   * @param results 分析结果
   * @returns 报告文件路径
   */
  async generate(results: IAnalysisResult): Promise<string | null> {
    try {
      await this.ensureOutputDir();

      const fileName = this.getReportFileName('json');
      const outputPath = this.getReportPath(fileName);

      // 准备导出的数据
      const exportData = {
        projectName: results.projectName,
        timestamp: this.formatDateTime(this.options.timestamp || new Date()),
        stats: results.stats,
        coverage: results.coverage,
        duplicates: results.duplicates,
        unusedCode: results.unusedCode,
        dependencies: results.dependencies,
        memoryLeaks: results.memoryLeaks,
        infiniteLoops: results.infiniteLoops,
        customRules: results.customRules,
        incrementalInfo: results.incrementalInfo,
      };

      // 写入JSON文件
      await fsPromises.writeFile(
        outputPath,
        JSON.stringify(exportData, null, 2)
      );

      return outputPath;
    } catch (error) {
      console.error('生成JSON报告失败:', error);
      return null;
    }
  }
}
