/**
 * Code Insight Analyst - 代码分析工具
 * 主模块导出
 */

// 导出分析器
export * from './core/engine.js';
export * from './core/processor.js';

// 导出CLI
export * from './cli/index.js';

// 版本信息
export const version = '0.1.0';

// 主入口
export default async function main(): Promise<void> {
  // 将在后续实现
  console.log('Code Insight Analyst 初始化中...');
}
