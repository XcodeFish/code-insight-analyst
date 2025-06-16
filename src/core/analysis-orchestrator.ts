import { Listr } from 'listr2';
import { Logger } from '../utils/logger';
import { ANALYSIS_OPTIONS, IAnalysisOption } from '../cli/options';
import { FileSystemService } from './file-system-service';
import { AstService } from './ast-service';
import { CoverageAnalyzer } from '../analyzers/coverage-analyzer';

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
  private getAnalyzer(type: string, targetPath: string): any {
    switch (type) {
      case 'coverage':
        return new CoverageAnalyzer(targetPath, this.astService);

      case 'method-dup':
        // 将在后续迭代中实现
        throw new Error('方法重复检测分析器尚未实现');

      case 'unused-code':
        // 将在后续迭代中实现
        throw new Error('未使用代码检测分析器尚未实现');

      case 'dependencies':
        // 将在后续迭代中实现
        throw new Error('依赖关系分析器尚未实现');

      case 'memory-leak':
        // 将在后续迭代中实现
        throw new Error('内存泄漏检测分析器尚未实现');

      case 'infinite-loop':
        // 将在后续迭代中实现
        throw new Error('死循环检测分析器尚未实现');

      default:
        throw new Error(`未知的分析类型: ${type}`);
    }
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
