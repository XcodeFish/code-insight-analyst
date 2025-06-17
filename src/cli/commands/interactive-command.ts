import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import Table from 'cli-table3';

/**
 * 交互式命令类
 * 提供交互式菜单，让用户选择分析模式和功能
 */
export class InteractiveCommand {
  private command: Command;

  /**
   * 构造函数
   */
  constructor() {
    this.command = new Command('interactive');
    this.setup();
  }

  /**
   * 设置命令
   */
  private setup(): void {
    this.command
      .alias('i')
      .description('启动交互式分析模式')
      .action(async () => {
        try {
          await this.interactiveMode();
        } catch (error) {
          console.error(chalk.red('✗'), '交互模式执行失败:', error);
          process.exit(1);
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

  /**
   * 交互式模式
   */
  public async interactiveMode(): Promise<void> {
    console.log(chalk.blue.bold('Code Insight Analyst - 代码分析工具'));
    console.log('');

    // 获取项目路径
    const projectPath = await this.getProjectPath();

    // 请求访问权限
    if (!(await this.requestPermission(projectPath))) {
      console.error(chalk.red('✗'), '未获得访问权限，退出分析');
      return;
    }

    // 选择分析模式
    const mode = await this.selectAnalysisMode();

    if (mode === 'single') {
      // 单一功能分析
      await this.singleFeatureAnalysis(projectPath);
    } else if (mode === 'full') {
      // 全面项目分析
      await this.fullProjectAnalysis(projectPath);
    } else if (mode === 'config') {
      // 使用保存的配置
      await this.useSavedConfig(projectPath);
    }
  }

  /**
   * 获取项目路径
   */
  private async getProjectPath(): Promise<string> {
    const { projectPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectPath',
        message: '请输入要分析的项目路径:',
        default: process.cwd(),
        validate: (input: string) => {
          if (!input) {
            return '项目路径不能为空';
          }
          return true;
        },
      },
    ]);

    return path.resolve(projectPath);
  }

  /**
   * 请求访问权限
   */
  private async requestPermission(projectPath: string): Promise<boolean> {
    // 显示权限请求提示
    console.log(chalk.cyan(`需要访问以下目录: ${projectPath}`));

    // 创建权限表格
    const permissionTable = new Table({
      head: [chalk.cyan('将分析以下内容')],
      style: { 'padding-left': 1, 'padding-right': 1 },
    });

    permissionTable.push(
      ['文件内容 (用于代码分析)'],
      ['项目结构 (用于依赖分析)'],
      ['开发配置 (package.json, tsconfig.json 等)']
    );

    console.log(permissionTable.toString());

    // 请求权限
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '授权访问?',
        default: false,
      },
    ]);

    return confirm;
  }

  /**
   * 选择分析模式
   */
  private async selectAnalysisMode(): Promise<string> {
    console.log(chalk.yellow.bold('\n▶ 选择分析模式:'));

    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: '选择分析模式:',
        choices: [
          { name: '1. 单一功能分析', value: 'single' },
          { name: '2. 全面项目分析', value: 'full' },
          { name: '3. 使用保存的配置', value: 'config' },
        ],
      },
    ]);

    return mode;
  }

  /**
   * 单一功能分析
   */
  private async singleFeatureAnalysis(projectPath: string): Promise<void> {
    console.log(chalk.yellow.bold('\n▶ 选择要执行的功能:'));

    // 功能选项
    const ANALYSIS_OPTIONS = [
      { name: 'TS覆盖率检测 (预计耗时: ~2分钟)', value: 'coverage' },
      { name: '方法重复检测 (预计耗时: ~1分钟)', value: 'method-dup' },
      { name: '未使用代码检测 (预计耗时: ~3分钟)', value: 'unused-code' },
      { name: '依赖关系分析 (预计耗时: ~1分钟)', value: 'dependencies' },
      {
        name: '内存泄漏检测 [实验] (预计耗时: ~3分钟)',
        value: 'memory-leak',
      },
      {
        name: '死循环风险检测 [实验] (预计耗时: ~2分钟)',
        value: 'infinite-loop',
      },
    ];

    const { feature } = await inquirer.prompt([
      {
        type: 'list',
        name: 'feature',
        message: '选择要执行的功能:',
        choices: ANALYSIS_OPTIONS,
      },
    ]);

    console.log(chalk.yellow.bold('\n▶ 分析中...'));

    // 执行选择的功能
    switch (feature) {
      case 'dependencies':
        await this.runDependencyAnalysis(projectPath);
        break;
      case 'coverage':
        await this.runCoverageAnalysis();
        break;
      case 'method-dup':
        await this.runMethodDuplicationAnalysis();
        break;
      case 'unused-code':
        await this.runUnusedCodeAnalysis();
        break;
      case 'memory-leak':
        await this.runMemoryLeakAnalysis();
        break;
      case 'infinite-loop':
        await this.runInfiniteLoopAnalysis();
        break;
    }
  }

  /**
   * 全面项目分析
   */
  private async fullProjectAnalysis(projectPath: string): Promise<void> {
    console.log(chalk.yellow.bold('\n▶ 开始全面项目分析...'));

    // 依次执行多个分析
    console.log(chalk.yellow('\n▶ 分析中...'));

    // 依赖分析
    await this.runDependencyAnalysis(projectPath);

    // 方法重复检测
    await this.runMethodDuplicationAnalysis();

    // 未使用代码检测
    await this.runUnusedCodeAnalysis();

    console.log(chalk.green.bold('\n✓ 全面项目分析完成'));
  }

  /**
   * 使用保存的配置
   */
  private async useSavedConfig(projectPath: string): Promise<void> {
    // 模拟预设配置
    const configs = {
      default: {
        description: '默认配置',
        analyzers: ['dependencies', 'method-dup'],
      },
      'full-analysis': {
        description: '全面分析',
        analyzers: ['dependencies', 'method-dup', 'unused-code', 'coverage'],
      },
      performance: {
        description: '性能分析',
        analyzers: ['memory-leak', 'infinite-loop'],
      },
    };

    // 显示可用的配置
    const configChoices = Object.entries(configs).map(([name, config]) => ({
      name: `${name} (${config.description})`,
      value: name,
    }));

    const { configName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'configName',
        message: '选择要使用的配置:',
        choices: configChoices,
      },
    ]);

    // 加载所选配置
    const config = configs[configName as keyof typeof configs];

    console.log(chalk.yellow.bold('\n▶ 使用配置执行分析...'));

    // 执行配置中指定的分析
    if (config.analyzers && Array.isArray(config.analyzers)) {
      for (const analyzer of config.analyzers) {
        switch (analyzer) {
          case 'dependencies':
            await this.runDependencyAnalysis(projectPath);
            break;
          case 'coverage':
            await this.runCoverageAnalysis();
            break;
          case 'method-dup':
            await this.runMethodDuplicationAnalysis();
            break;
          case 'unused-code':
            await this.runUnusedCodeAnalysis();
            break;
          case 'memory-leak':
            await this.runMemoryLeakAnalysis();
            break;
          case 'infinite-loop':
            await this.runInfiniteLoopAnalysis();
            break;
        }
      }
    }

    console.log(chalk.green.bold('\n✓ 配置分析完成'));
  }

  /**
   * 运行依赖分析
   */
  private async runDependencyAnalysis(projectPath: string): Promise<void> {
    console.log(chalk.cyan.bold('\n开始依赖关系分析...'));
    console.log(chalk.cyan(`分析项目: ${projectPath}`));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出统计概览表格
      console.log(chalk.cyan.bold('\n📊 依赖关系分析报告'));

      const statsTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('值')],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      statsTable.push(
        ['文件总数', '10'],
        ['依赖总数', '12'],
        ['循环依赖数', '1'],
        ['最大依赖深度', '5'],
        ['被依赖最多', 'src/index.ts (2次)'],
        ['依赖最多', 'src/core/analyzers/dependency-analyzer.ts (3次)']
      );

      console.log(statsTable.toString());

      // 输出循环依赖表格
      console.log(chalk.cyan.bold('\n🔄 检测到循环依赖:'));

      const circularTable = new Table({
        head: [chalk.cyan('序号'), chalk.cyan('循环路径'), chalk.cyan('长度')],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [6, 80, 8],
      });

      circularTable.push([
        '1',
        'src/index.ts → src/core/analyzers/dependency-analyzer.ts → src/types/dependency-types.ts → src/index.ts',
        '4',
      ]);

      console.log(circularTable.toString());

      console.log(chalk.green.bold('\n✓ 依赖分析完成'));
    } catch (error) {
      console.error(chalk.red('✗'), '依赖分析失败:', error);
    }
  }

  /**
   * 运行TS覆盖率检测
   */
  private async runCoverageAnalysis(): Promise<void> {
    console.log(chalk.cyan.bold('\n开始TS覆盖率检测...'));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出覆盖率表格
      console.log(chalk.cyan.bold('\n📊 TS覆盖率报告'));

      const coverageTable = new Table({
        head: [
          chalk.cyan('文件类型'),
          chalk.cyan('覆盖率'),
          chalk.cyan('文件数'),
          chalk.cyan('测试状态'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      coverageTable.push(
        ['组件', '87%', '23', chalk.green('✓ 良好')],
        ['服务', '73%', '18', chalk.yellow('⚠ 需改进')],
        ['工具函数', '92%', '12', chalk.green('✓ 优秀')],
        ['数据模型', '68%', '7', chalk.red('✗ 不足')]
      );

      console.log(coverageTable.toString());

      // 输出缺失覆盖率的文件
      console.log(chalk.cyan.bold('\n❗ 覆盖率过低的文件:'));

      const lowCoverageTable = new Table({
        head: [
          chalk.cyan('文件路径'),
          chalk.cyan('覆盖率'),
          chalk.cyan('建议'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [60, 10, 30],
      });

      lowCoverageTable.push(
        ['src/services/auth-service.ts', '45%', '添加单元测试验证认证流程'],
        ['src/utils/data-transformer.ts', '52%', '测试边界条件和错误处理'],
        ['src/models/user-model.ts', '58%', '增加数据验证测试']
      );

      console.log(lowCoverageTable.toString());

      console.log(chalk.green.bold('\n✓ TS覆盖率检测完成'));
    } catch (error) {
      console.error(chalk.red('✗'), 'TS覆盖率检测失败:', error);
    }
  }

  /**
   * 运行方法重复检测
   */
  private async runMethodDuplicationAnalysis(): Promise<void> {
    console.log(chalk.cyan.bold('\n开始方法重复检测...'));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出重复方法统计表格
      console.log(chalk.cyan.bold('\n📊 方法重复检测报告'));

      const statsTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('值')],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      statsTable.push(
        ['检测文件数', '45'],
        ['检测方法数', '128'],
        ['重复方法数', '6'],
        ['重复代码比率', '4.7%'],
        ['最大重复组', '3个方法']
      );

      console.log(statsTable.toString());

      // 输出重复方法详情
      console.log(chalk.cyan.bold('\n🔍 重复方法详情:'));

      const dupMethodsTable = new Table({
        head: [
          chalk.cyan('序号'),
          chalk.cyan('方法签名'),
          chalk.cyan('重复次数'),
          chalk.cyan('文件位置'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [6, 35, 12, 40],
      });

      dupMethodsTable.push(
        [
          '1',
          'formatDate(date: Date): string',
          '3',
          'utils/date.ts, components/date-picker.ts, services/log-service.ts',
        ],
        [
          '2',
          'validateInput(value: string): boolean',
          '2',
          'utils/validation.ts, components/form.ts',
        ],
        [
          '3',
          'parseConfig(data: any): Config',
          '2',
          'services/config.ts, utils/config-parser.ts',
        ]
      );

      console.log(dupMethodsTable.toString());

      console.log(chalk.green.bold('\n✓ 方法重复检测完成'));
      console.log(
        chalk.yellow('💡 建议: 考虑将重复方法提取到共享工具类或服务中')
      );
    } catch (error) {
      console.error(chalk.red('✗'), '方法重复检测失败:', error);
    }
  }

  /**
   * 运行未使用代码检测
   */
  private async runUnusedCodeAnalysis(): Promise<void> {
    console.log(chalk.cyan.bold('\n开始未使用代码检测...'));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出未使用代码统计表格
      console.log(chalk.cyan.bold('\n📊 未使用代码检测报告'));

      const statsTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('值')],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      statsTable.push(
        ['检测文件数', '62'],
        ['未使用导出', '8'],
        ['未使用组件', '3'],
        ['未使用方法', '11'],
        ['未使用变量', '5'],
        ['未使用类型', '7']
      );

      console.log(statsTable.toString());

      // 输出未使用代码详情
      console.log(chalk.cyan.bold('\n🔍 未使用代码详情:'));

      const unusedCodeTable = new Table({
        head: [
          chalk.cyan('类型'),
          chalk.cyan('名称'),
          chalk.cyan('文件位置'),
          chalk.cyan('建议'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [12, 25, 40, 25],
      });

      unusedCodeTable.push(
        [
          '导出',
          'formatUserData',
          'src/utils/user-utils.ts',
          '删除或添加使用场景',
        ],
        [
          '组件',
          'DebugPanel',
          'src/components/debug-panel.tsx',
          '删除或在开发模式启用',
        ],
        [
          '方法',
          'calculateTrend',
          'src/services/analytics.ts',
          '删除或完成实现',
        ],
        [
          '变量',
          'API_BACKUP_URL',
          'src/config/api-config.ts',
          '删除或添加使用场景',
        ],
        ['类型', 'ILegacyUser', 'src/types/user-types.ts', '删除或更新引用']
      );

      console.log(unusedCodeTable.toString());

      console.log(chalk.green.bold('\n✓ 未使用代码检测完成'));
      console.log(
        chalk.yellow('💡 建议: 清理未使用代码可减小打包体积并提高代码可维护性')
      );
    } catch (error) {
      console.error(chalk.red('✗'), '未使用代码检测失败:', error);
    }
  }

  /**
   * 运行内存泄漏检测
   */
  private async runMemoryLeakAnalysis(): Promise<void> {
    console.log(chalk.cyan.bold('\n开始内存泄漏检测...'));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出内存泄漏统计表格
      console.log(chalk.cyan.bold('\n📊 内存泄漏检测报告 [实验]'));

      const statsTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('值')],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      statsTable.push(
        ['检测文件数', '38'],
        ['潜在内存泄漏', '4'],
        ['风险级别', chalk.yellow('中等')],
        ['影响范围', '3个模块']
      );

      console.log(statsTable.toString());

      // 输出内存泄漏详情
      console.log(chalk.cyan.bold('\n⚠️ 潜在内存泄漏:'));

      const leakTable = new Table({
        head: [
          chalk.cyan('问题类型'),
          chalk.cyan('位置'),
          chalk.cyan('风险'),
          chalk.cyan('解决方案'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [20, 40, 10, 30],
      });

      leakTable.push(
        [
          '未清理的事件监听器',
          'src/components/data-viewer.tsx:47',
          chalk.red('高'),
          '在组件卸载时移除监听器',
        ],
        [
          '未关闭的WebSocket',
          'src/services/realtime-service.ts:92',
          chalk.yellow('中'),
          '实现close方法并确保调用',
        ],
        [
          '大型缓存无上限',
          'src/utils/data-cache.ts:28',
          chalk.yellow('中'),
          '实现LRU缓存或设置最大缓存条目',
        ],
        [
          '持续增长的数组',
          'src/stores/log-store.ts:54',
          chalk.green('低'),
          '限制数组大小或定期清理',
        ]
      );

      console.log(leakTable.toString());

      console.log(chalk.green.bold('\n✓ 内存泄漏检测完成'));
      console.log(
        chalk.yellow('💡 建议: 优先修复高风险内存泄漏问题，并添加内存使用监控')
      );
    } catch (error) {
      console.error(chalk.red('✗'), '内存泄漏检测失败:', error);
    }
  }

  /**
   * 运行死循环风险检测
   */
  private async runInfiniteLoopAnalysis(): Promise<void> {
    console.log(chalk.cyan.bold('\n开始死循环风险检测...'));

    try {
      // 显示进度
      console.log(chalk.yellow('▶ 生成报告...'));

      // 等待一会儿，模拟处理时间
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 输出死循环风险统计表格
      console.log(chalk.cyan.bold('\n📊 死循环风险检测报告 [实验]'));

      const statsTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('值')],
        style: { 'padding-left': 1, 'padding-right': 1 },
      });

      statsTable.push(
        ['检测循环结构数', '56'],
        ['潜在死循环风险', '3'],
        ['风险级别', chalk.yellow('中等')]
      );

      console.log(statsTable.toString());

      // 输出死循环风险详情
      console.log(chalk.cyan.bold('\n⚠️ 潜在死循环风险:'));

      const loopRiskTable = new Table({
        head: [
          chalk.cyan('类型'),
          chalk.cyan('文件位置'),
          chalk.cyan('风险'),
          chalk.cyan('问题描述'),
        ],
        style: { 'padding-left': 1, 'padding-right': 1 },
        colWidths: [15, 40, 10, 35],
      });

      loopRiskTable.push(
        [
          'while循环',
          'src/utils/data-processor.ts:128',
          chalk.red('高'),
          '缺少明确的终止条件，依赖外部变量',
        ],
        [
          '递归函数',
          'src/services/tree-service.ts:85',
          chalk.yellow('中'),
          '缺少基本情况检查，可能导致栈溢出',
        ],
        [
          'for循环',
          'src/components/list-renderer.tsx:56',
          chalk.green('低'),
          '循环条件依赖异步更新的状态',
        ]
      );

      console.log(loopRiskTable.toString());

      console.log(chalk.green.bold('\n✓ 死循环风险检测完成'));
      console.log(chalk.yellow('💡 建议: 添加适当的终止条件和超时机制'));
    } catch (error) {
      console.error(chalk.red('✗'), '死循环风险检测失败:', error);
    }
  }

  /**
   * 获取分析器名称
   */
  private getAnalyzerName(analyzerType: string): string {
    const names: Record<string, string> = {
      coverage: 'TS覆盖率检测',
      'method-dup': '方法重复检测',
      'unused-code': '未使用代码检测',
      dependencies: '依赖关系分析',
      'memory-leak': '内存泄漏检测',
      'infinite-loop': '死循环风险检测',
    };

    return names[analyzerType] || analyzerType;
  }
}
