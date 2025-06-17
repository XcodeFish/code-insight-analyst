#!/usr/bin/env node

/**
 * CLI 入口模块
 */
import { Command } from 'commander';
import { AnalyzeCommand } from './commands/analyze-command';
import { DependencyCommand } from './commands/dependency-command';
import { WatchCommand } from './commands/watch-command';
import { version } from '../../package.json';

/**
 * CLI程序入口
 */
export function run(): void {
  try {
    const program = new Command();

    program
      .name('code-insight')
      .version(version)
      .description('Code Insight Analyst - 代码分析工具');

    // 注册命令
    const analyzeCommand = new AnalyzeCommand();
    const dependencyCommand = new DependencyCommand();
    const watchCommand = new WatchCommand();

    analyzeCommand.register(program);
    dependencyCommand.register(program);
    watchCommand.register(program);

    // 添加帮助信息
    program.addHelpText(
      'after',
      `
示例:
  $ code-insight dependency                  # 分析当前项目的依赖关系
  $ code-insight dep -p ./my-project         # 分析指定项目的依赖关系
  $ code-insight dep -f html -o ./reports    # 生成HTML格式报告并保存到指定目录
  `
    );

    // 默认命令
    program.command('', { isDefault: true, hidden: true }).action(() => {
      program.help();
    });

    program.parse();
  } catch (error) {
    console.error(
      `错误: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// 执行CLI程序
run();
