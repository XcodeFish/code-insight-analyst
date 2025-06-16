import chalk from 'chalk';
import Table from 'cli-table3';
import { BaseReporter, IReporterOptions } from './base-reporter';
import { AnalysisResult } from '../types/analysis-result';
import { IDuplicateAnalysisResult } from '../analyzers/duplicate-code-analyzer';
import { IUnusedCodeAnalysisResult } from '../analyzers/unused-code-analyzer';

/**
 * 控制台报告生成器实现
 */
export class ConsoleReporter extends BaseReporter {
  /**
   * 创建控制台报告生成器实例
   * @param options 报告选项
   */
  constructor(options: IReporterOptions = {}) {
    super(options);
  }

  /**
   * 生成控制台报告
   * @param results 分析结果
   * @returns 处理结果
   */
  async generate(results: AnalysisResult | AnalysisResult[]): Promise<string> {
    const resultsArray = Array.isArray(results) ? results : [results];

    let output = '\n';
    output += chalk.bold.blue('============================\n');
    output += chalk.bold.blue('      代码分析报告          \n');
    output += chalk.bold.blue('============================\n\n');

    for (const result of resultsArray) {
      const analyzerName = this.getAnalyzerName(result);
      output += chalk.bold.green(
        `[${analyzerName}] 分析时间: ${this.formatDuration(result.duration)}\n`
      );

      // 根据不同类型的分析结果生成不同的报告
      if ('duplicates' in result) {
        output += this.generateDuplicateReport(
          result as IDuplicateAnalysisResult
        );
      } else if ('unusedImports' in result) {
        output += this.generateUnusedReport(
          result as IUnusedCodeAnalysisResult
        );
      }

      output += '\n';
    }

    // 输出到控制台
    console.log(output);

    return output;
  }

  /**
   * 生成重复代码分析报告
   * @param result 重复代码分析结果
   * @returns 格式化的报告字符串
   */
  private generateDuplicateReport(result: IDuplicateAnalysisResult): string {
    let output = '';

    // 总体统计信息
    output += chalk.yellow(
      `发现 ${result.totalDuplicates} 处重复代码，共 ${result.duplicateLines} 行\n`
    );
    output += chalk.yellow(`影响 ${result.affectedFiles.length} 个文件\n\n`);

    if (result.duplicates.size === 0) {
      output += chalk.green('未发现重复代码，做得很好！👍\n');
      return output;
    }

    // 创建表格显示详细信息
    if (this.options.verbose) {
      const table = new Table({
        head: ['类型', '名称', '文件', '行号', '重复次数'],
        style: { head: ['cyan'] },
      });

      // 对重复代码块进行排序（按重复次数和大小）
      const sortedDuplicates = Array.from(result.duplicates.values())
        .sort((a, b) => b.length - a.length || b[0].size - a[0].size)
        .slice(0, 15); // 只显示前15个最严重的重复

      for (const dupes of sortedDuplicates) {
        const firstDupe = dupes[0];
        const displayPath = this.shortenPath(firstDupe.filePath);

        table.push([
          firstDupe.type,
          firstDupe.name,
          displayPath,
          `${firstDupe.startLine}-${firstDupe.endLine}`,
          `${dupes.length}x (${firstDupe.size} 行)`,
        ]);
      }

      output += table.toString() + '\n';

      // 如果有更多未显示的重复项
      if (result.duplicates.size > 15) {
        output += chalk.gray(
          `...以及 ${result.duplicates.size - 15} 个其他重复项\n`
        );
      }
    } else {
      // 简要模式只显示汇总信息
      const dupesByType = new Map<string, number>();

      for (const dupes of result.duplicates.values()) {
        const type = dupes[0].type;
        dupesByType.set(type, (dupesByType.get(type) || 0) + 1);
      }

      for (const [type, count] of dupesByType.entries()) {
        output += chalk.yellow(`- ${count} 个重复的 ${type}\n`);
      }

      output += chalk.gray('使用 --verbose 选项查看详细信息\n');
    }

    return output;
  }

  /**
   * 生成未使用代码分析报告
   * @param result 未使用代码分析结果
   * @returns 格式化的报告字符串
   */
  private generateUnusedReport(result: IUnusedCodeAnalysisResult): string {
    let output = '';

    // 总体统计信息
    output += chalk.yellow(`发现 ${result.totalUnused} 处未使用的代码\n`);
    output += chalk.yellow(`影响 ${result.affectedFiles.length} 个文件\n\n`);

    if (result.totalUnused === 0) {
      output += chalk.green('未发现未使用的代码，做得很好！👍\n');
      return output;
    }

    // 统计各类型未使用代码
    const stats = [
      { name: '导入', count: result.unusedImports.length },
      { name: '变量', count: result.unusedVariables.length },
      { name: '函数', count: result.unusedFunctions.length },
      { name: '类', count: result.unusedClasses.length },
      { name: '接口', count: result.unusedInterfaces.length },
      { name: '类型', count: result.unusedTypes.length },
    ];

    for (const stat of stats) {
      if (stat.count > 0) {
        output += chalk.yellow(`- ${stat.count} 个未使用的${stat.name}\n`);
      }
    }

    // 详细信息
    if (this.options.verbose) {
      output += '\n';

      // 创建未使用代码项目表格
      const createTable = () =>
        new Table({
          head: ['类型', '名称', '文件', '行号', '作用域'],
          style: { head: ['cyan'] },
        });

      // 显示未使用的导入
      if (result.unusedImports.length > 0) {
        output += chalk.cyan('未使用的导入:\n');
        const table = createTable();

        for (const item of result.unusedImports.slice(0, 10)) {
          table.push([
            item.type,
            item.name,
            this.shortenPath(item.filePath),
            item.line,
            item.scope || '-',
          ]);
        }

        output += table.toString() + '\n';

        if (result.unusedImports.length > 10) {
          output += chalk.gray(
            `...以及 ${result.unusedImports.length - 10} 个其他未使用的导入\n`
          );
        }
      }

      // 显示未使用的变量
      if (result.unusedVariables.length > 0) {
        output += chalk.cyan('未使用的变量:\n');
        const table = createTable();

        for (const item of result.unusedVariables.slice(0, 10)) {
          table.push([
            item.type,
            item.name,
            this.shortenPath(item.filePath),
            item.line,
            item.scope || '-',
          ]);
        }

        output += table.toString() + '\n';

        if (result.unusedVariables.length > 10) {
          output += chalk.gray(
            `...以及 ${result.unusedVariables.length - 10} 个其他未使用的变量\n`
          );
        }
      }

      // 显示未使用的函数
      if (result.unusedFunctions.length > 0) {
        output += chalk.cyan('未使用的函数:\n');
        const table = createTable();

        for (const item of result.unusedFunctions.slice(0, 10)) {
          table.push([
            item.type,
            item.name,
            this.shortenPath(item.filePath),
            item.line,
            item.scope || '-',
          ]);
        }

        output += table.toString() + '\n';

        if (result.unusedFunctions.length > 10) {
          output += chalk.gray(
            `...以及 ${result.unusedFunctions.length - 10} 个其他未使用的函数\n`
          );
        }
      }
    } else {
      output += chalk.gray('使用 --verbose 选项查看详细信息\n');
    }

    return output;
  }

  /**
   * 缩短文件路径以便于显示
   * @param filePath 完整文件路径
   * @returns 简短的文件路径
   */
  private shortenPath(filePath: string): string {
    // 移除过长的路径前缀，只保留相对路径的最后部分
    const parts = filePath.split('/');
    if (parts.length > 3) {
      return '...' + parts.slice(-3).join('/');
    }
    return filePath;
  }
}
