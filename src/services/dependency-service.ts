import path from 'path';
import * as glob from 'glob';
import { DependencyAnalyzer } from '../core/analyzers/dependency-analyzer';
import {
  DependencyReportGenerator,
  ReportType,
} from '../core/report/report-generator';
import { AnalysisConfig } from '../core/config/config-manager';
import { PerformanceOptimizer } from '../core/performance/performance-optimizer';

/**
 * 依赖分析服务
 * 整合依赖分析功能，提供完整的分析流程
 */
export class DependencyService {
  /**
   * 项目路径
   */
  private readonly projectPath: string;

  /**
   * 分析配置
   */
  private readonly config: AnalysisConfig;

  /**
   * 性能优化器
   */
  private readonly optimizer: PerformanceOptimizer;

  /**
   * 依赖分析器
   */
  private analyzer: DependencyAnalyzer | null = null;

  /**
   * 构造函数
   * @param projectPath 项目路径
   * @param config 分析配置
   */
  constructor(projectPath: string, config: AnalysisConfig) {
    this.projectPath = path.resolve(projectPath);
    this.config = config;
    this.optimizer = new PerformanceOptimizer(config);
  }

  /**
   * 运行依赖分析
   * @returns 分析报告路径或控制台输出
   */
  async analyze(): Promise<string> {
    console.info(`开始分析项目: ${this.projectPath}`);
    console.info('正在检索项目文件...');

    // 获取需要分析的文件列表
    const files = await this.getProjectFiles();
    console.info(`找到 ${files.length} 个文件需要分析`);

    // 创建分析器
    this.analyzer = new DependencyAnalyzer(
      this.projectPath,
      this.config.includeExtensions
    );

    // 使用缓存进行分析
    const analysisResult = await this.optimizer.withCache(
      `dependency-analysis:${this.projectPath}`,
      async () => {
        console.info('正在分析依赖关系...');
        const result = await this.analyzer!.analyze();
        console.info('依赖分析完成');
        return result;
      },
      {
        ttl: this.config.performance?.cacheTTL || 86400,
      }
    );

    // 生成报告
    console.info('正在生成报告...');
    const reportGenerator = new DependencyReportGenerator();

    const outputFormat = this.config.outputFormat || 'console';
    const reportType = this.mapOutputFormatToReportType(outputFormat);

    // 是否需要详细报告
    const detailed = true;

    const reportPathOrContent = await reportGenerator.generate(
      analysisResult as unknown as Record<string, unknown>,
      {
        type: reportType,
        outputPath: `${this.config.outputPath || './code-insight-report'}/dependency-analysis.${outputFormat}`,
        projectName: this.config.projectName || path.basename(this.projectPath),
        detailed,
      }
    );

    // 如果是控制台报告，直接输出内容
    if (reportType === ReportType.CONSOLE) {
      console.log(reportPathOrContent);
      console.info(`\n分析完成`);
    } else {
      console.info(`分析完成，报告已生成: ${reportPathOrContent}`);
    }

    return reportPathOrContent;
  }

  /**
   * 获取项目文件列表
   * @returns 文件路径数组
   */
  private async getProjectFiles(): Promise<string[]> {
    // 构建include和exclude模式
    const includePatterns = (
      this.config.includeExtensions || ['ts', 'tsx', 'js', 'jsx']
    ).map((ext) => `**/*.${ext}`);

    const excludePatterns = (
      this.config.exclude || ['node_modules', 'dist', 'build', '.git']
    ).map((pattern) => `**/${pattern}/**`);

    // 使用glob查找文件
    const files: string[] = [];

    for (const pattern of includePatterns) {
      const matches = await this.globPromise(pattern, {
        cwd: this.projectPath,
        ignore: excludePatterns,
        absolute: false,
      });

      files.push(...matches);
    }

    return files;
  }

  /**
   * 转换输出格式为报告类型
   */
  private mapOutputFormatToReportType(format: string): ReportType {
    switch (format) {
      case 'html':
        return ReportType.HTML;
      case 'json':
        return ReportType.JSON;
      case 'markdown':
        return ReportType.MARKDOWN;
      default:
        return ReportType.CONSOLE;
    }
  }

  /**
   * Promise化的glob
   */
  private globPromise(
    pattern: string,
    options: glob.IOptions
  ): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      glob.glob(pattern, options, (err: Error | null, matches: string[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(matches);
        }
      });
    });
  }

  /**
   * 清理过期缓存
   */
  cleanCache(maxAgeDays = 30): void {
    this.optimizer.cleanCache(maxAgeDays);
  }
}
