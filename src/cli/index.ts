#!/usr/bin/env node

/**
 * CLI 入口模块
 */
import { CliApp } from './app';
import { ErrorHandler } from '../utils/error-handler';
import { Command } from 'commander';
import { AnalyzeCommand } from './commands/analyze-command';
import { DependencyCommand } from './commands/dependency-command';
import { WatchCommand } from './commands/watch-command';
import { version } from '../../package.json';

/**
 * 主函数
 */
async function main(): Promise<void> {
  const errorHandler = ErrorHandler.getInstance();

  try {
    // 初始化并运行CLI应用
    const app = new CliApp();
    await app.run();
  } catch (error) {
    errorHandler.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

// 执行主函数
main();

/**
 * CLI程序入口
 */
export function run(): void {
  const program = new Command();

  program.version(version);
  program.description('代码洞察分析工具 - 深入分析代码以提供质量改进建议');

  // 注册命令
  const analyzeCommand = new AnalyzeCommand();
  const dependencyCommand = new DependencyCommand();
  const watchCommand = new WatchCommand();

  analyzeCommand.register(program);
  dependencyCommand.register(program);
  watchCommand.register(program);

  // 默认命令
  program.command('', { isDefault: true, hidden: true }).action(() => {
    program.help();
  });

  program.parse();
}
