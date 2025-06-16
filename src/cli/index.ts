/**
 * CLI 入口模块
 */
import { Command } from 'commander';
import { version } from '../index.js';

export const program = new Command();

/**
 * CLI程序初始化
 */
export function initCLI(): void {
  program
    .name('code-insight')
    .description(
      '代码分析工具，用于检测代码质量、覆盖率、重复、未使用代码和潜在问题'
    )
    .version(version, '-v, --version', '显示版本号')
    .option('-d, --dir <directory>', '指定要分析的项目目录', '.')
    .option('-c, --config <file>', '指定配置文件路径')
    .option('-o, --output <file>', '指定输出报告文件路径')
    .option('--watch', '监视模式，检测文件变化')
    .option('--verbose', '显示详细执行信息');

  // 后续会添加各种命令
  // 如: program.addCommand(require('./commands/analyze').default);

  program.parse();
}

/**
 * CLI主入口
 */
export default function cli(): void {
  initCLI();
}
