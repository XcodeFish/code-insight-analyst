import { AnalysisResult } from '../types/analysis-result';

/**
 * 报告格式类型
 */
export enum ReportFormat {
  CONSOLE = 'console',
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown',
}

/**
 * 报告生成器选项
 */
export interface IReporterOptions {
  outputPath?: string;
  includeTimestamp?: boolean;
  verbose?: boolean;
}

/**
 * 基础报告生成器接口
 */
export interface IReporter {
  /**
   * 生成报告
   * @param results 分析结果
   * @returns 处理结果（例如生成的文件路径或输出内容）
   */
  generate(results: AnalysisResult | AnalysisResult[]): Promise<string>;
}

/**
 * 基础报告生成器抽象类
 */
export abstract class BaseReporter implements IReporter {
  protected options: IReporterOptions;

  /**
   * 创建基础报告生成器
   * @param options 报告选项
   */
  constructor(options: IReporterOptions = {}) {
    this.options = {
      outputPath: './reports',
      includeTimestamp: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * 生成唯一的报告文件名
   * @param extension 文件扩展名
   * @returns 完整的文件名
   */
  protected generateFileName(extension: string): string {
    const timestamp = this.options.includeTimestamp
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : '';
    return `report${timestamp}.${extension}`;
  }

  /**
   * 格式化持续时间
   * @param duration 持续时间（毫秒）
   * @returns 格式化后的时间字符串
   */
  protected formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    } else {
      return `${(duration / 1000).toFixed(2)}s`;
    }
  }

  /**
   * 根据结果类型获取分析器名称
   * @param result 分析结果
   * @returns 分析器名称
   */
  protected getAnalyzerName(result: AnalysisResult): string {
    // 基于结果对象属性推断分析器类型
    if ('duplicates' in result) {
      return '重复代码分析';
    } else if ('unusedImports' in result) {
      return '未使用代码分析';
    } else {
      return '未知分析';
    }
  }

  /**
   * 生成报告（抽象方法，子类必须实现）
   * @param results 分析结果
   * @returns 处理结果
   */
  abstract generate(
    results: AnalysisResult | AnalysisResult[]
  ): Promise<string>;
}
