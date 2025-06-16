/**
 * 定义可用的分析选项
 */

export interface IAnalysisOption {
  name: string;
  value: string;
  estimatedTime?: number; // 预计耗时(分钟)
  description?: string;
  isExperimental?: boolean;
}

export const ANALYSIS_OPTIONS: IAnalysisOption[] = [
  {
    name: 'TS覆盖率检测 (预计耗时: ~2分钟)',
    value: 'coverage',
    estimatedTime: 2,
    description: '分析代码的测试覆盖率，包括行/分支/语句覆盖率',
  },
  {
    name: '方法重复检测 (预计耗时: ~1分钟)',
    value: 'method-dup',
    estimatedTime: 1,
    description: '检测代码库中的重复方法实现',
  },
  {
    name: '未使用代码检测 (预计耗时: ~3分钟)',
    value: 'unused-code',
    estimatedTime: 3,
    description: '检测未被引用的代码，包括类、方法、变量等',
  },
  {
    name: '依赖关系分析 (预计耗时: ~2分钟)',
    value: 'dependencies',
    estimatedTime: 2,
    description: '分析代码的依赖关系和模块结构',
  },
  {
    name: '内存泄漏检测 [实验] (预计耗时: ~3分钟)',
    value: 'memory-leak',
    estimatedTime: 3,
    description: '检测潜在的内存泄漏问题（实验性功能）',
    isExperimental: true,
  },
  {
    name: '死循环风险检测 [实验] (预计耗时: ~2分钟)',
    value: 'infinite-loop',
    estimatedTime: 2,
    description: '识别可能导致死循环的代码模式（实验性功能）',
    isExperimental: true,
  },
  {
    name: '示例增量分析器 [监测模式] (预计耗时: ~1分钟)',
    value: 'example-incremental',
    estimatedTime: 1,
    description: '演示增量分析功能的示例分析器，适合监测模式',
  },
];
