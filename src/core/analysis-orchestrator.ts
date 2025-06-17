import { Listr } from 'listr2';
import { Logger } from '../utils/logger';
import { ANALYSIS_OPTIONS, IAnalysisOption } from '../cli/options';
import { FileSystemService } from './file-system-service';
import { AstService } from './ast-service';
import { CoverageAnalyzer } from '../analyzers/coverage-analyzer';
import { ExampleIncrementalAnalyzer } from '../analyzers/example-incremental-analyzer';

// 分析结果接口
export interface IAnalysisResult {
  type: string;
  data: unknown;
  summary?: {
    title: string;
    description: string;
    metrics: Record<string, unknown>;
  };
}

// Listr上下文类型
interface ListrContext {
  results?: IAnalysisResult[];
}

/**
 * 分析协调器
 * 负责协调各个分析器的执行
 */
export class AnalysisOrchestrator {
  private logger: Logger;
  private fsService: FileSystemService;
  private astService: AstService;
  private targetPath: string = '';

  constructor() {
    this.logger = new Logger();
    this.fsService = new FileSystemService();
    this.astService = new AstService();
  }

  /**
   * 执行分析
   * @param options 分析选项
   * @param targetPath 目标路径
   */
  async run(options: string[], targetPath: string): Promise<IAnalysisResult[]> {
    this.logger.debug(
      `开始分析，选项: ${options.join(', ')}, 路径: ${targetPath}`
    );

    this.targetPath = targetPath;

    // 分析前的准备，扫描目标目录
    await this.fsService.scanDirectory(targetPath);

    // 创建任务列表
    const tasks = new Listr<ListrContext>(
      options.map((opt) => ({
        title: `执行 ${this.getOptionName(opt)} 分析`,
        task: async (ctx, task) => {
          // 根据选项执行对应分析器
          const analyzer = this.getAnalyzer(opt, targetPath);

          // 执行分析
          const result = await analyzer.analyze((message: string) => {
            task.output = message;
          });

          // 将结果添加到上下文
          if (!ctx.results) ctx.results = [];
          ctx.results.push(result);

          return result;
        },
      })),
      {
        concurrent: false,
        rendererOptions: { showSubtasks: true, collapse: false } as any,
      }
    );

    try {
      // 执行分析任务
      const ctx = await tasks.run();
      return ctx.results || [];
    } catch (error) {
      this.logger.error('分析执行失败:', error);
      throw error;
    }
  }

  /**
   * 执行增量分析
   * @param files 要分析的文件路径数组
   * @param options 分析选项
   * @returns 分析结果
   */
  async runIncremental(
    files: string[],
    options: string[]
  ): Promise<Record<string, any>> {
    if (!files.length) {
      this.logger.debug('没有可分析的文件');
      return {};
    }

    this.logger.debug(
      `开始增量分析，文件: ${files.length} 个，选项: ${options.join(', ')}`
    );

    // 确保目标路径已设置，如果未设置，使用第一个文件的目录
    if (!this.targetPath) {
      const path = require('path');
      this.targetPath = path.dirname(files[0]);
    }

    const results: Record<string, any> = {};

    for (const opt of options) {
      try {
        // 获取分析器
        const analyzer = this.getAnalyzer(opt, this.targetPath);

        // 如果分析器支持增量分析，执行增量分析
        if (typeof analyzer.analyzeIncremental === 'function') {
          this.logger.debug(`执行 ${this.getOptionName(opt)} 增量分析...`);
          const result = await analyzer.analyzeIncremental(
            files,
            (message: string) => {
              this.logger.debug(`${this.getOptionName(opt)}: ${message}`);
            }
          );

          results[opt] = result;
        } else {
          // 如果不支持增量分析，执行完整分析
          this.logger.debug(
            `${this.getOptionName(opt)} 不支持增量分析，执行完整分析...`
          );
          const result = await analyzer.analyze((message: string) => {
            this.logger.debug(`${this.getOptionName(opt)}: ${message}`);
          });

          results[opt] = result;
        }
      } catch (error) {
        this.logger.error(`${this.getOptionName(opt)} 增量分析失败:`, error);
        results[opt] = {
          error: `分析失败: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    }

    return results;
  }

  /**
   * 获取预估分析时间
   * @param options 分析选项
   */
  getEstimatedTime(options: string[]): number {
    return options.reduce((total, opt) => {
      const option = ANALYSIS_OPTIONS.find(
        (o: IAnalysisOption) => o.value === opt
      );
      return total + (option?.estimatedTime || 1);
    }, 0);
  }

  /**
   * 获取分析器实例
   */
  private getAnalyzer(type: string, projectPath: string): any {
    // 这里根据type返回对应的分析器实例
    // 实际项目中应该维护一个分析器注册表
    if (type === 'ts-coverage') {
      return new CoverageAnalyzer(projectPath, this.astService);
    }

    if (type === 'duplicate-method') {
      return new ExampleIncrementalAnalyzer(projectPath, this.astService);
    }

    // 添加更多分析器...

    throw new Error(`未找到分析器: ${type}`);
  }

  /**
   * 根据选项值获取选项名称
   */
  private getOptionName(value: string): string {
    const option = ANALYSIS_OPTIONS.find(
      (opt: IAnalysisOption) => opt.value === value
    );
    return option ? option.name.split(' ')[0] : value;
  }
}
