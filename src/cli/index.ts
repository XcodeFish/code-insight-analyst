/**
 * CLI 入口模块
 */
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { PermissionManager } from '../core/permission-manager';
import { AnalysisOrchestrator } from '../core/analysis-orchestrator';
import { ConfigManager } from '../utils/config-manager';
import { Logger } from '../utils/logger';
import { ANALYSIS_OPTIONS, IAnalysisOption } from './options';

const logger = new Logger();
const permissionManager = new PermissionManager();
const configManager = new ConfigManager();
const orchestrator = new AnalysisOrchestrator();

// 立即执行函数，用于初始化CLI
(function initCLI(): void {
  const program = new Command();

  // 设置CLI基本信息
  program
    .name('code-insight')
    .description('高性能、多功能的代码分析工具')
    .version('0.1.0');

  // 项目分析命令
  program
    .command('analyze [path]')
    .description('分析项目代码')
    .option(
      '-m, --mode <mode>',
      '分析模式：single(单一功能)/full(全面分析)/config(配置)'
    )
    .option('-t, --type <type>', '分析类型，适用于单一功能模式')
    .option('-y, --yes', '自动确认所有提示')
    .option('-o, --output <output>', '输出报告文件路径')
    .option('--no-color', '禁用颜色输出')
    .option('-v, --verbose', '显示详细日志')
    .action(async (path = '.', options) => {
      try {
        // 设置路径和选项
        const targetPath = path || '.';
        logger.setVerbose(!!options.verbose);

        // 获取权限
        const hasPermission =
          options.yes || (await requestPermission(targetPath));
        if (!hasPermission) {
          logger.error('未获得权限，操作取消');
          process.exit(1);
        }

        // 选择分析模式和选项
        const mode = options.mode || (await selectAnalysisMode());
        const analysisOptions = options.type
          ? [options.type]
          : await selectAnalysisOptions(mode);

        if (analysisOptions.length === 0) {
          logger.error('未选择任何分析选项，操作取消');
          process.exit(1);
        }

        // 显示分析信息
        logger.info(`开始分析项目: ${chalk.cyan(targetPath)}`);
        logger.info(
          `选择的分析项: ${analysisOptions.map((opt) => chalk.yellow(getOptionName(opt))).join(', ')}`
        );
        logger.info(
          `预估分析时间: ${chalk.yellow(orchestrator.getEstimatedTime(analysisOptions) + '分钟')}`
        );

        // 执行分析
        const results = await orchestrator.run(analysisOptions, targetPath);

        // 输出报告
        const outputPath = options.output || './code-insight-report.html';
        logger.success(`分析完成! 报告已保存至 ${chalk.green(outputPath)}`);
      } catch (error) {
        logger.error('分析过程中发生错误:', error);
        process.exit(1);
      }
    });

  // 添加配置命令
  program
    .command('config')
    .description('管理配置')
    .option('--reset', '重置所有配置')
    .option('--show', '显示当前配置')
    .action((options) => {
      if (options.reset) {
        configManager.resetConfig();
        logger.success('所有配置已重置');
      } else if (options.show) {
        const config = configManager.getConfig();
        logger.info('当前配置:');
        console.log(JSON.stringify(config, null, 2));
      } else {
        program.help();
      }
    });

  // 帮助信息
  program.on('--help', () => {
    console.log('');
    console.log('示例:');
    console.log('  $ code-insight analyze               # 分析当前目录');
    console.log('  $ code-insight analyze ./my-project  # 分析指定目录');
    console.log('  $ code-insight analyze -t coverage   # 仅执行覆盖率分析');
  });

  // 解析命令行参数
  program.parse(process.argv);

  // 如果没有提供命令，显示交互式菜单
  if (!process.argv.slice(2).length) {
    startInteractiveMode();
  }
})();

/**
 * 启动交互式模式
 */
async function startInteractiveMode(): Promise<void> {
  console.log(chalk.cyan('=== Code Insight 代码分析工具 ==='));
  console.log('');

  const targetPath = await promptProjectPath();
  await analyzeProject(targetPath);
}

/**
 * 提示用户输入项目路径
 */
async function promptProjectPath(): Promise<string> {
  const { projectPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectPath',
      message: '请输入要分析的项目路径:',
      default: '.',
    },
  ]);
  return projectPath;
}

/**
 * 分析项目
 */
async function analyzeProject(targetPath: string): Promise<void> {
  const hasPermission = await requestPermission(targetPath);
  if (!hasPermission) {
    logger.error('未获得权限，操作取消');
    process.exit(1);
  }

  const mode = await selectAnalysisMode();
  const analysisOptions = await selectAnalysisOptions(mode);

  if (analysisOptions.length === 0) {
    logger.error('未选择任何分析选项，操作取消');
    process.exit(1);
  }

  logger.info(`开始分析项目: ${chalk.cyan(targetPath)}`);
  logger.info(
    `选择的分析项: ${analysisOptions.map((opt) => chalk.yellow(getOptionName(opt))).join(', ')}`
  );
  logger.info(
    `预估分析时间: ${chalk.yellow(orchestrator.getEstimatedTime(analysisOptions) + '分钟')}`
  );

  try {
    const results = await orchestrator.run(analysisOptions, targetPath);
    logger.success('分析完成! 报告已保存至 ./code-insight-report.html');
  } catch (error) {
    logger.error('分析过程中发生错误:', error);
    process.exit(1);
  }
}

/**
 * 请求权限
 */
async function requestPermission(path: string): Promise<boolean> {
  // 检查是否已有权限记录
  if (permissionManager.isAuthorized(path)) {
    logger.info(`检测到授权记录，访问路径: ${chalk.cyan(path)}`);
    return true;
  }

  const { permission } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'permission',
      message: `需要访问以下目录: ${path}\n将分析TS/JS/JSON文件\n授权访问?`,
      default: false,
    },
  ]);

  if (permission) {
    // 记录权限
    permissionManager.recordAccess(path);
  }

  return permission;
}

/**
 * 选择分析模式
 */
async function selectAnalysisMode(): Promise<string> {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: '选择分析模式:',
      choices: [
        { name: '单一功能分析', value: 'single' },
        { name: '全面项目分析', value: 'full' },
        { name: '使用保存的配置', value: 'config' },
      ],
    },
  ]);
  return mode;
}

/**
 * 选择分析选项
 */
async function selectAnalysisOptions(mode: string): Promise<string[]> {
  // 使用保存的配置
  if (mode === 'config') {
    const config = configManager.getConfig();
    if (config.lastUsedOptions && config.lastUsedOptions.length > 0) {
      return config.lastUsedOptions;
    }
    mode = 'single'; // 如果没有配置，回退到单一模式
  }

  // 全面分析模式
  if (mode === 'full') {
    return ANALYSIS_OPTIONS.map((opt) => opt.value);
  }

  // 单一功能分析模式
  const { actions } = await inquirer.prompt([
    {
      type: 'list',
      name: 'actions',
      message: '选择分析项目:',
      choices: ANALYSIS_OPTIONS,
    },
  ]);

  // 保存本次选择
  configManager.setLastUsedOptions([actions]);

  return [actions];
}

/**
 * 根据选项值获取选项名称
 */
function getOptionName(value: string): string {
  const option = ANALYSIS_OPTIONS.find((opt) => opt.value === value);
  return option ? option.name.split(' ')[0] : value;
}
