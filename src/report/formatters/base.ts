import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { IAnalysisResult } from '../../types/analysis';
import {
  IReportGenerator,
  IReportOptions,
  IChartData,
} from '../../types/report';

/**
 * 基础报告生成器
 */
export abstract class BaseReportGenerator implements IReportGenerator {
  protected options: IReportOptions;

  constructor(options: IReportOptions = {}) {
    this.options = {
      outputPath: './reports',
      title: '代码分析报告',
      detailed: true,
      includeCharts: true,
      ...options,
      timestamp: options.timestamp || new Date(),
    };
  }

  /**
   * 生成报告
   * @param results 分析结果
   */
  abstract generate(results: IAnalysisResult): Promise<string | null>;

  /**
   * 确保输出目录存在
   */
  protected async ensureOutputDir(): Promise<void> {
    const outputDir = this.options.outputPath || './reports';
    if (!fs.existsSync(outputDir)) {
      await fsPromises.mkdir(outputDir, { recursive: true });
    }
  }

  /**
   * 格式化日期时间
   * @param date 日期对象
   * @returns 格式化的日期时间字符串
   */
  protected formatDateTime(date: Date): string {
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  /**
   * 格式化持续时间
   * @param ms 毫秒数
   * @returns 格式化的持续时间字符串
   */
  protected formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * 生成报告文件名
   * @param extension 文件扩展名
   * @returns 报告文件名
   */
  protected getReportFileName(extension: string): string {
    const timestamp = this.options.timestamp || new Date();
    const dateString = timestamp
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');

    const projectName = this.options.projectName || 'project';
    const sanitizedProjectName = projectName.replace(/[^\w-]/g, '_');

    return `${sanitizedProjectName}-report-${dateString}.${extension}`;
  }

  /**
   * 生成报告完整路径
   * @param fileName 文件名
   * @returns 报告完整路径
   */
  protected getReportPath(fileName: string): string {
    return path.join(this.options.outputPath || './reports', fileName);
  }

  /**
   * 分析代码覆盖率图表数据
   * @param results 分析结果
   * @returns 覆盖率图表数据
   */
  protected getCoverageChartData(results: IAnalysisResult): IChartData | null {
    if (!results.coverage || results.coverage.length === 0) {
      return null;
    }

    // 计算平均覆盖率数据
    const avgCoverage = {
      line: 0,
      statement: 0,
      branch: 0,
      function: 0,
    };

    results.coverage.forEach((file) => {
      avgCoverage.line += file.lineCoverage;
      avgCoverage.statement += file.statementCoverage;
      avgCoverage.branch += file.branchCoverage;
      avgCoverage.function += file.functionCoverage;
    });

    const fileCount = results.coverage.length;
    avgCoverage.line /= fileCount;
    avgCoverage.statement /= fileCount;
    avgCoverage.branch /= fileCount;
    avgCoverage.function /= fileCount;

    return {
      title: '代码覆盖率概览',
      type: 'bar',
      labels: ['行覆盖率', '语句覆盖率', '分支覆盖率', '函数覆盖率'],
      datasets: [
        {
          label: '覆盖率百分比',
          data: [
            avgCoverage.line * 100,
            avgCoverage.statement * 100,
            avgCoverage.branch * 100,
            avgCoverage.function * 100,
          ],
          backgroundColor: [
            'rgba(54, 162, 235, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(153, 102, 255, 0.7)',
          ],
        },
      ],
    };
  }

  /**
   * 分析重复代码图表数据
   * @param results 分析结果
   * @returns 重复代码图表数据
   */
  protected getDuplicatesChartData(
    results: IAnalysisResult
  ): IChartData | null {
    if (!results.duplicates) {
      return null;
    }

    const dupeRate = results.duplicates.totalDuplicationRate * 100;
    const uniqueRate = 100 - dupeRate;

    return {
      title: '代码重复度分析',
      type: 'pie',
      labels: ['唯一代码', '重复代码'],
      datasets: [
        {
          data: [uniqueRate, dupeRate],
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 99, 132, 0.7)',
          ],
        },
      ],
    };
  }

  /**
   * 分析未使用代码图表数据
   * @param results 分析结果
   * @returns 未使用代码图表数据
   */
  protected getUnusedCodeChartData(
    results: IAnalysisResult
  ): IChartData | null {
    if (!results.unusedCode) {
      return null;
    }

    const unusedCode = results.unusedCode;

    return {
      title: '未使用代码分析',
      type: 'bar',
      labels: [
        '未使用导入',
        '未使用变量',
        '未使用函数',
        '未使用类',
        '未使用导出',
      ],
      datasets: [
        {
          label: '数量',
          data: [
            unusedCode.unusedImports.length,
            unusedCode.unusedVariables.length,
            unusedCode.unusedFunctions.length,
            unusedCode.unusedClasses.length,
            unusedCode.unusedExports.length,
          ],
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
        },
      ],
    };
  }

  /**
   * 分析依赖图表数据
   * @param results 分析结果
   * @returns 依赖图表数据
   */
  protected getDependencyChartData(
    results: IAnalysisResult
  ): IChartData | null {
    if (!results.dependencies) {
      return null;
    }

    const dependencies = results.dependencies;

    return {
      title: '依赖分析',
      type: 'bar',
      labels: ['循环依赖', '未使用依赖', '缺失依赖'],
      datasets: [
        {
          label: '数量',
          data: [
            dependencies.circularDependencies.length,
            dependencies.unusedDependencies.length,
            dependencies.missingDependencies.length,
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(255, 159, 64, 0.7)',
          ],
        },
      ],
    };
  }

  /**
   * 分析风险图表数据
   * @param results 分析结果
   * @returns 风险图表数据
   */
  protected getRiskChartData(results: IAnalysisResult): IChartData | null {
    const memoryLeakCount = results.memoryLeaks?.potentialLeaks.length || 0;
    const infiniteLoopCount =
      results.infiniteLoops?.potentialInfiniteLoops.length || 0;

    if (memoryLeakCount === 0 && infiniteLoopCount === 0) {
      return null;
    }

    // 计算不同风险级别的问题数量
    const riskLevels = {
      low: 0,
      medium: 0,
      high: 0,
    };

    if (results.memoryLeaks) {
      results.memoryLeaks.potentialLeaks.forEach((leak) => {
        riskLevels[leak.riskLevel]++;
      });
    }

    if (results.infiniteLoops) {
      results.infiniteLoops.potentialInfiniteLoops.forEach((loop) => {
        riskLevels[loop.riskLevel]++;
      });
    }

    return {
      title: '代码风险分析',
      type: 'doughnut',
      labels: ['高风险', '中风险', '低风险'],
      datasets: [
        {
          data: [riskLevels.high, riskLevels.medium, riskLevels.low],
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
          ],
        },
      ],
    };
  }

  /**
   * 分析增量变化图表数据
   * @param results 分析结果
   * @returns 增量变化图表数据
   */
  protected getIncrementalChartData(
    results: IAnalysisResult
  ): IChartData | null {
    if (!results.incrementalInfo?.trends) {
      return null;
    }

    const trends = results.incrementalInfo.trends;
    const trendValues = [
      trends.coverageTrend || 0,
      trends.duplicationTrend || 0,
      (trends.unusedCodeTrend || 0) * -1, // 反转，使负值表示好的变化
      (trends.circularDependenciesTrend || 0) * -1, // 反转，使负值表示好的变化
    ];

    return {
      title: '与上次分析相比的变化趋势',
      type: 'bar',
      labels: ['覆盖率', '重复代码', '未使用代码', '循环依赖'],
      datasets: [
        {
          label: '变化百分比',
          data: trendValues.map((v) => parseFloat(v.toFixed(2))),
          backgroundColor: trendValues.map((value) =>
            value >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'
          ),
        },
      ],
    };
  }

  /**
   * 准备所有图表数据
   * @param results 分析结果
   * @returns 所有图表数据
   */
  prepareChartData(results: IAnalysisResult): IChartData[] {
    if (!this.options.includeCharts) {
      return [];
    }

    // 添加各种图表数据
    const charts = [
      this.getCoverageChartData(results),
      this.getDuplicatesChartData(results),
      this.getUnusedCodeChartData(results),
      this.getDependencyChartData(results),
      this.getRiskChartData(results),
    ];

    // 如果有增量分析数据，添加趋势图表
    if (results.incrementalInfo?.trends) {
      const incrementalChart = this.getIncrementalChartData(results);
      if (incrementalChart) {
        charts.push(incrementalChart);
      }
    }

    // 过滤掉null值
    return charts.filter((chart) => chart !== null) as IChartData[];
  }
}
