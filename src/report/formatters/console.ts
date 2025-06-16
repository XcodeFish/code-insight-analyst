import chalk from 'chalk';
import { Table } from 'console-table-printer';

import { BaseReportGenerator } from './base';
import { IAnalysisResult, ILocation } from '../../types/analysis';
import { IReportOptions } from '../../types/report';

/**
 * 控制台报告生成器
 */
export class ConsoleReportGenerator extends BaseReportGenerator {
  constructor(options: IReportOptions = {}) {
    super(options);
  }

  /**
   * 生成控制台报告
   * @param results 分析结果
   * @returns null (控制台输出不生成文件)
   */
  async generate(results: IAnalysisResult): Promise<string | null> {
    try {
      this.printHeader(results);
      this.printSummary(results);

      if (results.coverage && results.coverage.length > 0) {
        this.printCoverageSummary(results);
      }

      if (results.duplicates) {
        this.printDuplicatesSummary(results.duplicates);
      }

      if (results.unusedCode) {
        this.printUnusedCodeSummary(results.unusedCode);
      }

      if (results.dependencies) {
        this.printDependenciesSummary(results.dependencies);
      }

      if (results.memoryLeaks) {
        this.printRiskSummary(
          '内存泄漏风险',
          results.memoryLeaks.potentialLeaks
        );
      }

      if (results.infiniteLoops) {
        this.printRiskSummary(
          '潜在死循环',
          results.infiniteLoops.potentialInfiniteLoops
        );
      }

      if (results.incrementalInfo?.trends) {
        this.printIncrementalInfo(results.incrementalInfo);
      }

      this.printFooter();

      return null; // 控制台输出不返回文件路径
    } catch (error) {
      console.error('生成控制台报告失败:', error);
      return null;
    }
  }

  /**
   * 打印报告头部
   * @param results 分析结果
   */
  private printHeader(results: IAnalysisResult): void {
    console.log('\n');
    console.log(chalk.bgBlue.white.bold(' 代码分析报告 '));
    console.log(chalk.blue('='.repeat(50)));
    console.log(`${chalk.bold('项目:')} ${results.projectName}`);
    console.log(
      `${chalk.bold('时间:')} ${this.formatDateTime(this.options.timestamp || new Date())}`
    );
    console.log(
      `${chalk.bold('分析耗时:')} ${this.formatDuration(results.stats.duration)}`
    );
    console.log(chalk.blue('='.repeat(50)));
    console.log('\n');
  }

  /**
   * 打印总体摘要
   * @param results 分析结果
   */
  private printSummary(results: IAnalysisResult): void {
    console.log(chalk.bgYellow.black.bold(' 分析摘要 '));
    console.log(`总文件数: ${chalk.bold(results.stats.totalFiles.toString())}`);
    console.log(`总代码行: ${chalk.bold(results.stats.totalLines.toString())}`);

    // 计算问题总数
    const unusedCount = results.unusedCode
      ? results.unusedCode.unusedImports.length +
        results.unusedCode.unusedVariables.length +
        results.unusedCode.unusedFunctions.length +
        results.unusedCode.unusedClasses.length +
        results.unusedCode.unusedExports.length
      : 0;

    const duplicatesCount = results.duplicates
      ? results.duplicates.duplicates.length
      : 0;

    const circularCount = results.dependencies
      ? results.dependencies.circularDependencies.length
      : 0;

    const memoryLeaksCount = results.memoryLeaks
      ? results.memoryLeaks.potentialLeaks.length
      : 0;

    const infiniteLoopsCount = results.infiniteLoops
      ? results.infiniteLoops.potentialInfiniteLoops.length
      : 0;

    const totalIssues =
      unusedCount +
      duplicatesCount +
      circularCount +
      memoryLeaksCount +
      infiniteLoopsCount;

    console.log(`发现问题: ${chalk.bold.red(totalIssues.toString())}`);
    console.log('\n');
  }

  /**
   * 打印覆盖率摘要
   * @param results 分析结果
   */
  private printCoverageSummary(results: IAnalysisResult): void {
    if (!results.coverage || results.coverage.length === 0) return;

    console.log(chalk.bgGreen.black.bold(' 代码覆盖率 '));

    // 计算平均覆盖率
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

    // 格式化百分比
    const formatPercent = (value: number): string => {
      const percent = (value * 100).toFixed(2);
      const color = value < 0.7 ? 'red' : value < 0.8 ? 'yellow' : 'green';
      return chalk[color](`${percent}%`);
    };

    console.log(`行覆盖率: ${formatPercent(avgCoverage.line)}`);
    console.log(`语句覆盖率: ${formatPercent(avgCoverage.statement)}`);
    console.log(`分支覆盖率: ${formatPercent(avgCoverage.branch)}`);
    console.log(`函数覆盖率: ${formatPercent(avgCoverage.function)}`);

    console.log('\n');
  }

  /**
   * 打印重复代码摘要
   * @param duplicates 重复代码结果
   */
  private printDuplicatesSummary(duplicates: any): void {
    if (!duplicates) return;

    console.log(chalk.bgMagenta.black.bold(' 代码重复分析 '));
    console.log(
      `总重复率: ${chalk.bold((duplicates.totalDuplicationRate * 100).toFixed(2) + '%')}`
    );
    console.log(
      `重复块数: ${chalk.bold(duplicates.duplicates.length.toString())}`
    );

    if (duplicates.duplicates.length > 0 && this.options.detailed) {
      console.log('\n重复代码块TOP5:');

      const table = new Table({
        columns: [
          { name: 'files', title: '文件数', alignment: 'center' },
          { name: 'lines', title: '行数', alignment: 'center' },
          { name: 'similarity', title: '相似度', alignment: 'center' },
          { name: 'locations', title: '位置', alignment: 'left' },
        ],
      });

      // 按行数和相似度排序，取前5个
      const top5 = [...duplicates.duplicates]
        .sort((a, b) => b.lines * b.similarity - a.lines * a.similarity)
        .slice(0, 5);

      top5.forEach((dupe) => {
        table.addRow({
          files: dupe.locations.length,
          lines: dupe.lines,
          similarity: (dupe.similarity * 100).toFixed(0) + '%',
          locations: dupe.locations
            .map((loc: ILocation) => `${loc.filePath}:${loc.startLine || '?'}`)
            .join('\n'),
        });
      });

      table.printTable();
    }

    console.log('\n');
  }

  /**
   * 打印未使用代码摘要
   * @param unusedCode 未使用代码结果
   */
  private printUnusedCodeSummary(unusedCode: any): void {
    if (!unusedCode) return;

    console.log(chalk.bgCyan.black.bold(' 未使用代码分析 '));

    const unusedImports = unusedCode.unusedImports.length;
    const unusedVariables = unusedCode.unusedVariables.length;
    const unusedFunctions = unusedCode.unusedFunctions.length;
    const unusedClasses = unusedCode.unusedClasses.length;
    const unusedExports = unusedCode.unusedExports.length;

    console.log(`未使用导入: ${chalk.bold(unusedImports.toString())}`);
    console.log(`未使用变量: ${chalk.bold(unusedVariables.toString())}`);
    console.log(`未使用函数: ${chalk.bold(unusedFunctions.toString())}`);
    console.log(`未使用类: ${chalk.bold(unusedClasses.toString())}`);
    console.log(`未使用导出: ${chalk.bold(unusedExports.toString())}`);

    console.log('\n');
  }

  /**
   * 打印依赖关系摘要
   * @param dependencies 依赖关系结果
   */
  private printDependenciesSummary(dependencies: any): void {
    if (!dependencies) return;

    console.log(chalk.bgYellow.black.bold(' 依赖关系分析 '));

    const circularDeps = dependencies.circularDependencies.length;
    const unusedDeps = dependencies.unusedDependencies.length;
    const missingDeps = dependencies.missingDependencies.length;

    console.log(`循环依赖: ${chalk.bold.red(circularDeps.toString())}`);
    console.log(`未使用依赖: ${chalk.bold.yellow(unusedDeps.toString())}`);
    console.log(`缺失依赖: ${chalk.bold.red(missingDeps.toString())}`);

    if (circularDeps > 0 && this.options.detailed) {
      console.log('\n循环依赖详情:');
      dependencies.circularDependencies
        .slice(0, 5)
        .forEach((cycle: string[], index: number) => {
          console.log(`${index + 1}. ${cycle.join(' → ')} → ${cycle[0]}`);
        });

      if (dependencies.circularDependencies.length > 5) {
        console.log(
          `...以及${dependencies.circularDependencies.length - 5}个其他循环依赖`
        );
      }
    }

    console.log('\n');
  }

  /**
   * 打印风险摘要（内存泄漏或死循环）
   * @param title 标题
   * @param items 风险项列表
   */
  private printRiskSummary(title: string, items: any[]): void {
    if (!items || items.length === 0) return;

    console.log(chalk.bgRed.white.bold(` ${title} `));
    console.log(`发现问题: ${chalk.bold.red(items.length.toString())}`);

    // 按风险级别分类
    const byRiskLevel = {
      high: items.filter((item) => item.riskLevel === 'high').length,
      medium: items.filter((item) => item.riskLevel === 'medium').length,
      low: items.filter((item) => item.riskLevel === 'low').length,
    };

    console.log(`高风险: ${chalk.bold.red(byRiskLevel.high.toString())}`);
    console.log(`中风险: ${chalk.bold.yellow(byRiskLevel.medium.toString())}`);
    console.log(`低风险: ${chalk.bold.green(byRiskLevel.low.toString())}`);

    if (this.options.detailed && items.length > 0) {
      console.log('\n高风险问题详情:');

      const highRiskItems = items
        .filter((item) => item.riskLevel === 'high')
        .slice(0, 3);

      if (highRiskItems.length === 0) {
        console.log('无高风险问题');
      } else {
        highRiskItems.forEach((item, index) => {
          console.log(
            `${index + 1}. ${chalk.red(item.location.filePath)}:${item.location.startLine || '?'}`
          );
          if ('reason' in item) {
            console.log(`   原因: ${item.reason}`);
          } else if ('description' in item) {
            console.log(`   描述: ${item.description}`);
          }
          if ('suggestion' in item && item.suggestion) {
            console.log(`   建议: ${item.suggestion}`);
          }
        });
      }
    }

    console.log('\n');
  }

  /**
   * 打印增量分析信息
   * @param incrementalInfo 增量分析信息
   */
  private printIncrementalInfo(incrementalInfo: any): void {
    if (!incrementalInfo || !incrementalInfo.trends) return;

    console.log(chalk.bgBlue.white.bold(' 增量分析 '));

    if (incrementalInfo.baseCommit && incrementalInfo.currentCommit) {
      console.log(
        `与基准版本 ${chalk.bold(incrementalInfo.baseCommit.substring(0, 7))} 比较:`
      );
    }

    console.log(
      `变更文件: ${chalk.bold(incrementalInfo.changedFiles.length.toString())}`
    );

    const trends = incrementalInfo.trends;

    const formatTrend = (value?: number): string => {
      if (value === undefined || value === 0) return chalk.dim('无变化');

      const formatted = `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
      return value > 0 ? chalk.green(formatted) : chalk.red(formatted);
    };

    if (trends.coverageTrend !== undefined) {
      console.log(`覆盖率变化: ${formatTrend(trends.coverageTrend)}`);
    }

    if (trends.duplicationTrend !== undefined) {
      // 重复率是负向指标，反转颜色
      const dupeFormatted = `${trends.duplicationTrend > 0 ? '+' : ''}${(trends.duplicationTrend * 100).toFixed(2)}%`;
      const dupeColor = trends.duplicationTrend > 0 ? chalk.red : chalk.green;
      console.log(`重复代码变化: ${dupeColor(dupeFormatted)}`);
    }

    if (trends.unusedCodeTrend !== undefined) {
      // 未使用代码是负向指标，反转颜色
      const unusedFormatted = `${trends.unusedCodeTrend > 0 ? '+' : ''}${(trends.unusedCodeTrend * 100).toFixed(2)}%`;
      const unusedColor = trends.unusedCodeTrend > 0 ? chalk.red : chalk.green;
      console.log(`未使用代码变化: ${unusedColor(unusedFormatted)}`);
    }

    if (trends.circularDependenciesTrend !== undefined) {
      // 循环依赖是负向指标，反转颜色
      const circularFormatted = `${trends.circularDependenciesTrend > 0 ? '+' : ''}${(trends.circularDependenciesTrend * 100).toFixed(2)}%`;
      const circularColor =
        trends.circularDependenciesTrend > 0 ? chalk.red : chalk.green;
      console.log(`循环依赖变化: ${circularColor(circularFormatted)}`);
    }

    console.log('\n');
  }

  /**
   * 打印报告底部
   */
  private printFooter(): void {
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.bold('详细报告可通过生成HTML或JSON格式查看'));
    console.log(chalk.blue('='.repeat(50)));
    console.log('\n');
  }
}
