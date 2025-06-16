import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config-manager';
import { PermissionManager } from '../../core/permission-manager';
import {
  WatchService,
  FileChangeInfo,
  FileChangeType,
} from '../../core/watch/watch-service';
import { AnalysisOrchestrator } from '../../core/analysis-orchestrator';

/**
 * 监测命令类
 * 实现代码变更的持续监测与分析
 */
export class WatchCommand {
  private logger: Logger;
  private configManager: ConfigManager;
  private permissionManager: PermissionManager;
  private watchService: WatchService;
  private analysisOrchestrator: AnalysisOrchestrator;

  constructor() {
    this.logger = new Logger();
    this.configManager = new ConfigManager();
    this.permissionManager = new PermissionManager();
    this.watchService = new WatchService();
    this.analysisOrchestrator = new AnalysisOrchestrator();

    // 监听变更事件
    this.watchService.on('changes', this.handleFileChanges.bind(this));
  }

  /**
   * 注册命令
   */
  register(program: Command): void {
    program
      .command('watch')
      .description('启动持续监测模式，监控代码变更并实时分析')
      .option('-p, --path <path>', '指定项目路径', process.cwd())
      .option(
        '-i, --interval <ms>',
        '监测间隔（毫秒）',
        (v) => parseInt(v, 10),
        5000
      )
      .option('--no-prompt', '禁用交互式提示')
      .option('--analyzers <items>', '指定要使用的分析器，逗号分隔')
      .action(async (options) => {
        try {
          await this.execute(options);
        } catch (error) {
          this.logger.error('监测命令执行失败:', error);
          process.exit(1);
        }
      });
  }

  /**
   * 执行监测命令
   */
  async execute(options: {
    path: string;
    interval: number;
    prompt?: boolean;
    analyzers?: string;
  }): Promise<void> {
    const projectPath = path.resolve(options.path);

    // 请求权限
    if (
      !(await this.requestPermission(projectPath, options.prompt !== false))
    ) {
      this.logger.error('未获得授权，退出监测模式');
      return;
    }

    // 更新配置
    await this.updateWatchConfig(options);

    // 选择分析器
    const analyzers = await this.selectAnalyzers(options);
    if (!analyzers.length) {
      this.logger.warn('未选择任何分析器，将仅监控文件变更');
    } else {
      this.logger.info(
        `已选择 ${analyzers.length} 个分析器: ${analyzers.join(', ')}`
      );
    }

    // 启动监测服务
    const spinner = ora('启动监测服务...').start();
    try {
      await this.watchService.start(projectPath);
      spinner.succeed('监测服务已启动');

      this.logger.info(chalk.green('已进入监测模式，按 Ctrl+C 退出'));
      this.logger.info(`监测目录: ${chalk.cyan(projectPath)}`);

      // 设置退出处理
      this.setupExitHandlers();
    } catch (error) {
      spinner.fail('启动监测服务失败');
      this.logger.error('无法启动监测服务:', error);
      throw error;
    }
  }

  /**
   * 处理文件变更
   */
  private async handleFileChanges(changes: FileChangeInfo[]): Promise<void> {
    this.logger.info(chalk.yellow(`检测到 ${changes.length} 个文件变更:`));

    // 分类显示变更
    const added = changes.filter((c) => c.type === FileChangeType.ADDED);
    const modified = changes.filter((c) => c.type === FileChangeType.MODIFIED);
    const deleted = changes.filter((c) => c.type === FileChangeType.DELETED);

    if (added.length) {
      this.logger.info(chalk.green(`  新增: ${added.length} 个文件`));
      added.forEach((c) =>
        this.logger.debug(
          chalk.green(`    + ${path.relative(process.cwd(), c.path)}`)
        )
      );
    }

    if (modified.length) {
      this.logger.info(chalk.blue(`  修改: ${modified.length} 个文件`));
      modified.forEach((c) =>
        this.logger.debug(
          chalk.blue(`    ~ ${path.relative(process.cwd(), c.path)}`)
        )
      );
    }

    if (deleted.length) {
      this.logger.info(chalk.red(`  删除: ${deleted.length} 个文件`));
      deleted.forEach((c) =>
        this.logger.debug(
          chalk.red(`    - ${path.relative(process.cwd(), c.path)}`)
        )
      );
    }

    // 执行分析
    const watchConfig = this.configManager.get('watchMode');
    const analysisOptions = watchConfig?.analyzers || [];

    if (analysisOptions.length) {
      try {
        this.logger.info('开始分析变更文件...');

        // 筛选只分析新增和修改的文件
        const filesToAnalyze = [...added, ...modified].map((c) => c.path);
        if (filesToAnalyze.length) {
          const results = await this.analysisOrchestrator.runIncremental(
            filesToAnalyze,
            analysisOptions as string[]
          );
          this.logger.info('分析完成');
          this.displayResults(results);
        }
      } catch (error) {
        this.logger.error('分析失败:', error);
      }
    }
  }

  /**
   * 展示分析结果
   */
  private displayResults(results: Record<string, any>): void {
    this.logger.info(chalk.bold('分析结果摘要:'));

    for (const [analyzer, result] of Object.entries(results)) {
      this.logger.info(chalk.cyan(`${analyzer}:`));

      if (typeof result === 'object' && result !== null) {
        if (Array.isArray(result)) {
          this.logger.info(`  发现 ${result.length} 个问题`);
        } else if ('issues' in result && Array.isArray(result.issues)) {
          this.logger.info(`  发现 ${result.issues.length} 个问题`);
        } else if ('warnings' in result && Array.isArray(result.warnings)) {
          this.logger.info(`  发现 ${result.warnings.length} 个警告`);
        } else {
          this.logger.info('  分析完成');
        }
      } else {
        this.logger.info('  分析完成');
      }
    }
  }

  /**
   * 设置退出处理器
   */
  private setupExitHandlers(): void {
    const exitHandler = async (): Promise<void> => {
      this.logger.info('正在停止监测服务...');
      await this.watchService.stop();
      process.exit();
    };

    // 监听退出信号
    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);
    process.on('exit', exitHandler);
  }

  /**
   * 请求权限
   */
  private async requestPermission(
    projectPath: string,
    canPrompt: boolean
  ): Promise<boolean> {
    // 检查是否已有权限
    if (this.permissionManager.isAuthorized(projectPath)) {
      return true;
    }

    if (!canPrompt) {
      this.logger.error('需要授权访问目录，但禁用了交互式提示');
      return false;
    }

    return this.permissionManager.requestAccess(projectPath);
  }

  /**
   * 更新监测配置
   */
  private async updateWatchConfig(options: {
    path: string;
    interval: number;
  }): Promise<void> {
    const watchConfig = this.configManager.get('watchMode') || {
      enabled: true,
      interval: 5000,
      patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
      ],
    };

    // 更新配置
    watchConfig.enabled = true;
    if (options.interval) {
      watchConfig.interval = options.interval;
    }

    this.configManager.set('watchMode', watchConfig);
  }

  /**
   * 选择分析器
   */
  private async selectAnalyzers(options: {
    analyzers?: string;
    prompt?: boolean;
  }): Promise<string[]> {
    // 如果命令行指定了分析器，直接使用
    if (options.analyzers) {
      return options.analyzers.split(',').map((a) => a.trim());
    }

    // 获取配置中的分析器
    const watchConfig = this.configManager.get('watchMode');
    if (
      watchConfig &&
      Array.isArray(watchConfig.analyzers) &&
      watchConfig.analyzers.length
    ) {
      return watchConfig.analyzers as string[];
    }

    // 如果禁用了提示，使用默认分析器
    if (options.prompt === false) {
      return ['unused-code', 'method-dup'];
    }

    // 交互式选择分析器
    const ANALYSIS_OPTIONS = [
      { name: 'TS覆盖率检测 (预计耗时: ~2分钟/次)', value: 'coverage' },
      { name: '方法重复检测 (预计耗时: ~1分钟/次)', value: 'method-dup' },
      { name: '未使用代码检测 (预计耗时: ~3分钟/次)', value: 'unused-code' },
      { name: '依赖关系分析 (预计耗时: ~1分钟/次)', value: 'dependencies' },
      {
        name: '内存泄漏检测 [实验] (预计耗时: ~3分钟/次)',
        value: 'memory-leak',
      },
      {
        name: '死循环风险检测 [实验] (预计耗时: ~2分钟/次)',
        value: 'infinite-loop',
      },
    ];

    const { analyzerChoices } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'analyzerChoices',
        message: '选择监测时要使用的分析器:',
        choices: ANALYSIS_OPTIONS,
        default: ['unused-code', 'method-dup'],
      },
    ]);

    // 保存选择到配置
    const config = this.configManager.get('watchMode') || {};
    config.analyzers = analyzerChoices;
    this.configManager.set('watchMode', config);

    return analyzerChoices;
  }
}
