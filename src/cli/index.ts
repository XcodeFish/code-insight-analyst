#!/usr/bin/env node

/**
 * CLI 入口模块
 */
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { DuplicateCodeAnalyzer } from '../analyzers/duplicate-code-analyzer';
import { UnusedCodeAnalyzer } from '../analyzers/unused-code-analyzer';
import { ConsoleReporter } from '../reporters/console-reporter';
import { HtmlReporter } from '../reporters/html-reporter';
import { ErrorHandler, ErrorLevel } from '../utils/error-handler';
import { tryCatch } from '../utils/try-catch-wrapper';
import { withProgress } from '../utils/with-progress';

// 创建命令行程序
const program = new Command();

// 初始化错误处理器
const errorHandler = ErrorHandler.getInstance();

// 设置版本和描述
program
  .name('code-insight')
  .description('Code Insight Analyst - 代码分析工具')
  .version('0.1.0');

// 重复代码检测命令
program
  .command('duplicate')
  .alias('dup')
  .description('检测代码库中的重复代码')
  .argument('[dir]', '要分析的目录', process.cwd())
  .option('-m, --min-lines <lines>', '最小重复行数阈值', '5')
  .option('-v, --verbose', '显示详细信息', false)
  .option('-f, --format <format>', '报告格式 (console, html)', 'console')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .action(async (dir, options) => {
    await tryCatch(
      async () => {
        // 解析参数
        const projectPath = path.resolve(process.cwd(), dir);
        const minLines = parseInt(options.minLines, 10);

        console.log(chalk.blue(`正在分析目录: ${projectPath}`));
        console.log(chalk.blue(`最小重复行数阈值: ${minLines}`));

        // 执行分析
        const analyzer = new DuplicateCodeAnalyzer(projectPath, minLines);
        const result = await analyzer.analyze();

        // 生成报告
        if (options.format === 'html') {
          const htmlReporter = new HtmlReporter({
            outputPath: options.output,
            includeTimestamp: true,
          });
          await htmlReporter.generate(result);
        } else {
          const consoleReporter = new ConsoleReporter({
            verbose: options.verbose,
          });
          await consoleReporter.generate(result);
        }
      },
      '重复代码分析失败',
      ErrorLevel.ERROR
    );
  });

// 未使用代码检测命令
program
  .command('unused')
  .description('检测代码库中未使用的代码')
  .argument('[dir]', '要分析的目录', process.cwd())
  .option('-v, --verbose', '显示详细信息', false)
  .option('-f, --format <format>', '报告格式 (console, html)', 'console')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-i, --ignore <patterns>', '忽略模式（使用逗号分隔的正则表达式）', '')
  .action(async (dir, options) => {
    await tryCatch(
      async () => {
        // 解析参数
        const projectPath = path.resolve(process.cwd(), dir);
        const ignorePatterns = options.ignore ? options.ignore.split(',') : [];

        console.log(chalk.blue(`正在分析目录: ${projectPath}`));
        if (ignorePatterns.length > 0) {
          console.log(chalk.blue(`忽略模式: ${ignorePatterns.join(', ')}`));
        }

        // 执行分析
        const analyzer = new UnusedCodeAnalyzer(projectPath, ignorePatterns);
        const result = await analyzer.analyze();

        // 生成报告
        if (options.format === 'html') {
          const htmlReporter = new HtmlReporter({
            outputPath: options.output,
            includeTimestamp: true,
          });
          await htmlReporter.generate(result);
        } else {
          const consoleReporter = new ConsoleReporter({
            verbose: options.verbose,
          });
          await consoleReporter.generate(result);
        }
      },
      '未使用代码分析失败',
      ErrorLevel.ERROR
    );
  });

// 综合分析命令
program
  .command('analyze')
  .description('执行综合代码分析')
  .argument('[dir]', '要分析的目录', process.cwd())
  .option('-v, --verbose', '显示详细信息', false)
  .option('-f, --format <format>', '报告格式 (console, html)', 'html')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-m, --min-lines <lines>', '最小重复行数阈值', '5')
  .option('-i, --ignore <patterns>', '忽略模式（使用逗号分隔的正则表达式）', '')
  .action(async (dir, options) => {
    await tryCatch(
      async () => {
        // 解析参数
        const projectPath = path.resolve(process.cwd(), dir);
        const minLines = parseInt(options.minLines, 10);
        const ignorePatterns = options.ignore ? options.ignore.split(',') : [];

        console.log(chalk.blue(`正在对 ${projectPath} 进行综合分析...`));

        // 使用withProgress执行任务
        const results = await withProgress(
          [
            {
              title: '检测重复代码',
              task: async () => {
                const analyzer = new DuplicateCodeAnalyzer(
                  projectPath,
                  minLines
                );
                return await analyzer.analyze();
              },
            },
            {
              title: '检测未使用代码',
              task: async () => {
                const analyzer = new UnusedCodeAnalyzer(
                  projectPath,
                  ignorePatterns
                );
                return await analyzer.analyze();
              },
            },
          ],
          '正在执行代码分析'
        );

        // 生成报告
        if (options.format === 'html') {
          const htmlReporter = new HtmlReporter({
            outputPath: options.output,
            includeTimestamp: true,
            title: '综合代码分析报告',
          });
          await htmlReporter.generate(Object.values(results));
        } else {
          const consoleReporter = new ConsoleReporter({
            verbose: options.verbose,
          });
          await consoleReporter.generate(Object.values(results));
        }
      },
      '综合代码分析失败',
      ErrorLevel.ERROR
    );
  });

// 错误处理
program.exitOverride();

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    errorHandler.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

// 执行主函数
main();
