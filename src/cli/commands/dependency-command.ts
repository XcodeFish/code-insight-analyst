import { Command, Option } from 'commander';
import { DependencyService } from '../../services/dependency-service';
import { Logger } from '../../utils/logger';
import { AnalysisConfig } from '../../core/config/config-manager';

const logger = new Logger();

/**
 * 依赖关系分析命令
 */
export class DependencyCommand {
  private readonly command: Command;

  /**
   * 创建依赖分析命令实例
   */
  constructor() {
    this.command = new Command('dependency')
      .alias('dep')
      .description('分析项目依赖关系')
      .argument('<path>', '项目路径')
      .option('-c, --circular', '只检测循环依赖')
      .option('-d, --detailed', '包含详细依赖信息')
      .addOption(
        new Option('-f, --format <format>', '输出格式')
          .choices(['console', 'json', 'html', 'markdown'])
          .default('console')
      )
      .option('-o, --output <path>', '输出文件路径')
      .option(
        '-e, --extensions <exts>',
        '文件扩展名，逗号分隔',
        'js,jsx,ts,tsx'
      )
      .action(this.execute.bind(this));
  }

  /**
   * 获取命令实例
   */
  getCommand(): Command {
    return this.command;
  }

  /**
   * 执行依赖分析命令
   */
  private async execute(
    projectPath: string,
    options: {
      circular?: boolean;
      detailed?: boolean;
      format?: 'console' | 'json' | 'html' | 'markdown';
      output?: string;
      extensions?: string;
    }
  ): Promise<void> {
    try {
      logger.info(`开始分析项目依赖关系: ${projectPath}`);

      // 解析文件扩展名
      const fileExtensions = options.extensions?.split(',') || [
        'js',
        'jsx',
        'ts',
        'tsx',
      ];

      // 创建分析配置
      const config: AnalysisConfig = {
        includeExtensions: fileExtensions,
        outputFormat: options.format || 'console',
        outputPath: options.output || './code-insight-report',
        performance: {
          useCache: true,
          cacheTTL: 86400, // 缓存1天
        },
      };

      // 创建依赖服务
      const service = new DependencyService(projectPath, config);

      // 运行分析
      const reportPath = await service.analyze();

      logger.info(`分析完成，报告已生成: ${reportPath}`);
    } catch (error) {
      logger.error(`依赖分析失败: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
