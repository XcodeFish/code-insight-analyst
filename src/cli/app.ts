#!/usr/bin/env node

import { Command } from 'commander';
import { PermissionPrompt } from './prompt/permission-prompt';
import { DependencyCommand } from './commands/dependency-command';
import { WatchCommand } from './commands/watch-command';
import { AnalyzeCommand } from './commands/analyze-command';
import { InteractiveCommand } from './commands/interactive-command';
import { ErrorHandler } from '../utils/error-handler';

/**
 * CLI应用类
 */
export class CliApp {
  private program: Command;
  private errorHandler: ErrorHandler;
  private permissionPrompt: PermissionPrompt;

  /**
   * 构造函数
   */
  constructor() {
    this.program = new Command();
    this.errorHandler = ErrorHandler.getInstance();
    this.permissionPrompt = new PermissionPrompt();

    this.setupProgram();
  }

  /**
   * 配置命令行程序
   */
  private setupProgram(): void {
    this.program
      .name('code-insight')
      .description('Code Insight Analyst - 代码分析工具')
      .version('0.1.0');

    // 注册命令
    this.registerCommands();

    // 设置默认行为：当没有输入任何子命令时，运行交互式模式
    this.program.action(async () => {
      try {
        const interactiveCommand = new InteractiveCommand();
        await interactiveCommand.interactiveMode();
      } catch (error) {
        this.errorHandler.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });

    // 添加帮助信息
    this.program.addHelpText(
      'after',
      `
示例:
  $ code-insight                              # 启动交互式分析模式
  $ code-insight dependency                   # 分析当前项目的依赖关系
  $ code-insight dep -p ./my-project          # 分析指定项目的依赖关系
  $ code-insight dep -f html -o ./reports     # 生成HTML格式报告并保存到指定目录
  `
    );

    // 错误处理
    this.program.exitOverride();
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // 注册依赖分析命令
    const dependencyCommand = new DependencyCommand();
    this.program.addCommand(dependencyCommand.getCommand());

    // 注册监测命令
    const watchCommand = new WatchCommand();
    watchCommand.register(this.program);

    // 注册分析命令
    const analyzeCommand = new AnalyzeCommand();
    analyzeCommand.register(this.program);

    // 注册交互式命令
    const interactiveCommand = new InteractiveCommand();
    this.program.addCommand(interactiveCommand.getCommand());
  }

  /**
   * 运行CLI程序
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      // 如果是帮助命令或版本命令，不输出错误
      if (
        error instanceof Error &&
        (error.message === '(outputHelp)' ||
          error.message === '(outputVersion)')
      ) {
        process.exit(0);
      }

      this.errorHandler.error(error instanceof Error ? error : String(error));
      process.exit(1);
    }
  }
}

/**
 * 入口函数
 */
function main(): void {
  try {
    const app = new CliApp();
    app.run();
  } catch (error) {
    console.error(`错误: ${(error as Error).message}`);
    process.exit(1);
  }
}

// 执行入口函数
main();
