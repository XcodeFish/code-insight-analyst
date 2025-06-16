import chalk from 'chalk';

/**
 * 日志记录器
 */
export class Logger {
  private verbose: boolean = false;

  /**
   * 设置是否显示详细日志
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * 记录普通信息
   */
  info(message: string, ...args: unknown[]): void {
    console.info(chalk.blue('ℹ'), message, ...args);
  }

  /**
   * 记录成功信息
   */
  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green('✓'), message, ...args);
  }

  /**
   * 记录警告信息
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(chalk.yellow('⚠'), message, ...args);
  }

  /**
   * 记录错误信息
   */
  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red('✗'), message, ...args);
  }

  /**
   * 记录调试信息(仅在详细模式下显示)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      console.debug(chalk.magenta('🔍'), message, ...args);
    }
  }

  /**
   * 显示进度信息
   */
  progress(step: number, total: number, message: string): void {
    const percentage = Math.round((step / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    console.log(`${progressBar} ${percentage}% | ${message}`);
  }

  /**
   * 创建进度条
   */
  private createProgressBar(percentage: number): string {
    const width = 20;
    const completed = Math.floor((width * percentage) / 100);
    const remaining = width - completed;

    const filledBar = '█'.repeat(completed);
    const emptyBar = '░'.repeat(remaining);

    return chalk.cyan(`[${filledBar}${emptyBar}]`);
  }
}
