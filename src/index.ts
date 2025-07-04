/**
 * Code Insight Analyst - 代码分析工具
 * 主模块导出
 */

// 导出分析器
export * from './core/engine';
export * from './core/processor';

// 导出报告相关
export * from './report';
export * from './report/visualizers/chart-visualizer';

// 导出增量分析
export * from './core/incremental';

// 导出自定义规则引擎
export * from './core/rules';

// 导出CLI
export * from './cli/index';

// 版本信息
export const version = '0.1.0';

// 主入口
export default async function main(): Promise<void> {
  // 将在后续实现
  console.log('Code Insight Analyst 初始化中...');
}
