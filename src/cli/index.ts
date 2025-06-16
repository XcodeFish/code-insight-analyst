#!/usr/bin/env node

/**
 * CLI 入口模块
 */
import { CliApp } from './app';
import { ErrorHandler } from '../utils/error-handler';

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
