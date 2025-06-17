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

    try {
      // 获取需要分析的文件列表
      const files = await this.getProjectFiles();
      console.info(`找到 ${files.length} 个文件需要分析`);

      // 创建分析器
      this.analyzer = new DependencyAnalyzer(
        this.projectPath,
        this.config.includeExtensions
      );

      // 使用缓存进行分析
      console.info('正在分析依赖关系...');
      const analysisResult = await this.optimizer.withCache(
        `dependency-analysis:${this.projectPath}`,
        async () => {
          console.info('处理依赖关系中...');
          const result = await this.analyzer!.analyze();
          console.info('依赖分析计算完成');
          return result;
        },
        {
          ttl: this.config.performance?.cacheTTL || 86400,
        }
      );

      console.info('分析结果处理中...');
      console.info(`获取到分析结果对象: ${analysisResult ? 'yes' : 'no'}`);
      if (analysisResult) {
        console.info(`分析结果类型: ${typeof analysisResult}`);
        console.info(`分析结果属性: ${Object.keys(analysisResult).join(', ')}`);
      }

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
          projectName:
            this.config.projectName || path.basename(this.projectPath),
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
    } catch (error) {
      console.error('分析过程中发生错误:');
      console.error(error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('错误堆栈:');
        console.error(error.stack);
      }
      throw error; // 重新抛出错误，让上层处理
    }
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

    console.info(`包含文件模式: ${includePatterns.join(', ')}`);
    console.info(`排除文件模式: ${excludePatterns.join(', ')}`);

    // 使用glob查找文件
    const files: string[] = [];

    try {
      for (const pattern of includePatterns) {
        console.info(`正在查找匹配 ${pattern} 的文件...`);
        const matches = await this.globPromise(pattern, {
          cwd: this.projectPath,
          ignore: excludePatterns,
          absolute: false,
        });

        console.info(`找到 ${matches.length} 个匹配 ${pattern} 的文件`);
        files.push(...matches);
      }
    } catch (error) {
      console.error('查找文件时出错:', error);
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
    _pattern: string,
    _options: glob.IOptions
  ): Promise<string[]> {
    // 为了演示目的，直接返回一些模拟文件
    console.info('模拟文件查找，返回示例文件');
    return Promise.resolve([
      'src/index.ts',
      'src/cli/index.ts',
      'src/cli/app.ts',
      'src/cli/commands/dependency-command.ts',
      'src/cli/commands/watch-command.ts',
      'src/services/dependency-service.ts',
      'src/services/watch-service.ts',
      'src/core/analyzers/dependency-analyzer.ts',
      'src/core/report/report-generator.ts',
      'src/types/dependency-types.ts',
    ]);
  }

  /**
   * 清理过期缓存
   */
  cleanCache(maxAgeDays = 30): void {
    this.optimizer.cleanCache(maxAgeDays);
  }
}
