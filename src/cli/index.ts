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

    // 先检查命令是否存在
    if (!analyzeCommand || !dependencyCommand || !watchCommand) {
      console.error('命令对象初始化失败');
      process.exit(1);
    }

    // 检查register方法是否存在
    if (typeof analyzeCommand.register !== 'function') {
      console.error('analyzeCommand.register 不是一个函数');
      console.error('analyzeCommand:', JSON.stringify(analyzeCommand));
      process.exit(1);
    }

    if (typeof dependencyCommand.register !== 'function') {
      console.error('dependencyCommand.register 不是一个函数');
      console.error('dependencyCommand:', JSON.stringify(dependencyCommand));
      process.exit(1);
    }

    if (typeof watchCommand.register !== 'function') {
      console.error('watchCommand.register 不是一个函数');
      console.error('watchCommand:', JSON.stringify(watchCommand));
      process.exit(1);
    }

    // 注册命令
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

    // 设置默认行为
    program.action(() => {
      program.help();
    });

    program.parse();
  } catch (error) {
    console.error(
      `错误: ${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof Error && error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 执行CLI程序
run();
