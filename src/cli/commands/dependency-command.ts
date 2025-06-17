import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { PermissionPrompt } from '../prompt/permission-prompt';
import { DependencyService } from '../../services/dependency-service';
import { ConfigManager } from '../../utils/config-manager';
import { AnalysisConfig } from '../../core/config/config-manager';
import { ErrorHandler } from '../../utils/error-handler';

/**
 * 依赖分析命令
 */
export class DependencyCommand {
  private command: Command;
  private permissionPrompt: PermissionPrompt;
  private configManager: ConfigManager;
  private errorHandler: ErrorHandler;

  /**
   * 构造函数
   */
  constructor() {
    this.command = new Command('dependency');
    this.permissionPrompt = new PermissionPrompt();
    this.configManager = new ConfigManager();
    this.errorHandler = ErrorHandler.getInstance();

    this.setup();
  }

  /**
   * 设置命令
   */
  private setup(): void {
    this.command
      .alias('dep')
      .description('分析项目依赖关系')
      .argument('[dir]', '要分析的目录', process.cwd())
      .option('-p, --project <dir>', '指定项目路径')
      .option(
        '-f, --format <format>',
        '报告格式 (console, html, json)',
        'console'
      )
      .option('-o, --output <dir>', '报告输出目录', './reports')
      .option('-c, --circular', '仅检测循环依赖')
      .option('-v, --verbose', '显示详细信息', false)
      .action(async (dir, options) => {
        try {
          // 解析项目路径
          const projectPath = path.resolve(
            process.cwd(),
            options.project || dir
          );

          console.log(chalk.blue(`依赖分析: ${projectPath}`));

          // 请求访问权限
          const hasPermission =
            await this.permissionPrompt.requestPermission(projectPath);

          if (!hasPermission) {
            console.log(chalk.red('权限被拒绝，无法继续分析'));
            process.exit(1);
            return;
          }

          // 创建分析配置
          const analysisConfig: AnalysisConfig = {
            projectName: path.basename(projectPath),
            outputFormat: options.format as
              | 'console'
              | 'html'
              | 'json'
              | 'markdown',
            outputPath: path.resolve(process.cwd(), options.output),
            dependency: {
              includeNpm: false,
              includeTypeImports: true,
              generateGraph: true,
            },
            includeExtensions: ['ts', 'tsx', 'js', 'jsx'],
            exclude: ['node_modules', 'dist', 'build', '.git'],
            performance: {
              useCache: true,
              cacheTTL: 86400,
              useParallel: true,
              maxWorkers: 4,
            },
          };

          // 执行依赖分析
          const service = new DependencyService(projectPath, analysisConfig);
          await service.analyze();
        } catch (error) {
          const errorMessage = error instanceof Error ? error : String(error);
          await this.errorHandler.error(errorMessage, {
            command: 'dependency',
          });
        }
      });
  }

  /**
   * 获取命令实例
   */
  getCommand(): Command {
    return this.command;
  }

  /**
   * 注册命令到程序
   * @param program Commander程序实例
   */
  public register(program: Command): void {
    program.addCommand(this.command);
  }
}
