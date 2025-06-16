#!/usr/bin/env node

import { Command } from 'commander';
import { DependencyCommand } from './commands/dependency-command';

/**
 * 创建CLI程序
 */
function createProgram(): void {
  const program = new Command();

  program.name('code-insight').description('代码洞察分析工具').version('1.0.0');

  // 注册依赖分析命令
  const dependencyCommand = new DependencyCommand();
  program.addCommand(dependencyCommand.getCommand());

  // 添加帮助信息
  program.addHelpText(
    'after',
    `
示例:
  $ code-insight dependency                  # 分析当前项目的依赖关系
  $ code-insight dep ./my-project            # 分析指定项目的依赖关系
  $ code-insight dep ./my-project -f html -o ./reports    # 生成HTML格式报告并保存到指定目录
  `
  );

  // 解析参数
  program.parse(process.argv);

  // 如果没有提供命令，显示帮助
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

/**
 * 入口函数
 */
function main(): void {
  try {
    createProgram();
  } catch (error) {
    console.error(`错误: ${(error as Error).message}`);
    process.exit(1);
  }
}

// 执行入口函数
main();
