/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest */
import { IAnalysisResult } from '../../src/core/analysis-orchestrator';

/**
 * 分析器接口
 */
interface IAnalyzer {
  id: string;
  name: string;
  description: string;
  supportedFileTypes: string[];
  supportsIncrementalAnalysis?: boolean;
  analyze: (
    progressCallback?: (message: string) => void
  ) => Promise<IAnalysisResult>;
  analyzeIncremental?: (
    files: string[],
    progressCallback?: (message: string) => void
  ) => Promise<IAnalysisResult>;
}

/**
 * 创建模拟分析协调器
 */
export function createMockAnalysisOrchestrator() {
  // 存储已注册的分析器
  const analyzers: IAnalyzer[] = [];
  const results: IAnalysisResult[] = [];
  let resultStore: Record<string, any> = {};
  const analyzerNames: Record<string, string> = {
    'duplicate-method': '方法重复检测',
    'unused-code': '未使用代码检测',
    'dependency-analysis': '依赖关系分析',
    'ts-coverage': 'TS覆盖率检测',
    'memory-leak': '内存泄漏检测',
  };

  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    run: jest
      .fn()
      .mockImplementation(async (options: string[], targetPath: string) => {
        // 模拟运行分析器
        results.length = 0; // 清空之前的结果
        for (const option of options) {
          const analyzer = analyzers.find((a) => a.id === option);
          if (analyzer) {
            const result = await analyzer.analyze();
            results.push(result);
            resultStore[result.type] = result.data;
          }
        }
        return results;
      }),
    runIncremental: jest
      .fn()
      .mockImplementation(async (changedFiles: string[], options: string[]) => {
        // 模拟运行增量分析
        const incrementalResults: Record<string, any> = {};
        for (const option of options) {
          const analyzer = analyzers.find((a) => a.id === option);
          if (analyzer) {
            if (
              analyzer.supportsIncrementalAnalysis &&
              changedFiles.length > 0
            ) {
              const result = await analyzer.analyzeIncremental?.(changedFiles);
              if (result) {
                incrementalResults[option] = result;
                resultStore[result.type] = result.data;
              }
            } else if (changedFiles.length > 0) {
              const result = await analyzer.analyze();
              incrementalResults[option] = result;
              resultStore[result.type] = result.data;
            }
          }
        }
        return incrementalResults;
      }),
    getResults: jest.fn().mockImplementation(() => resultStore),
    clearResults: jest.fn().mockImplementation(() => {
      resultStore = {};
      results.length = 0;
    }),
    registerAnalyzer: jest.fn().mockImplementation((analyzer: IAnalyzer) => {
      analyzers.push(analyzer);
    }),
    getAnalyzer: jest.fn().mockImplementation((id: string) => {
      return analyzers.find((a) => a.id === id) || null;
    }),
    getAnalyzers: jest.fn().mockImplementation(() => analyzers),
    getOptionName: jest.fn().mockImplementation((option: string) => {
      return analyzerNames[option] || option;
    }),
    getEstimatedTime: jest.fn().mockImplementation((options: string[]) => {
      const estimateMap: Record<string, number> = {
        'duplicate-method': 60000,
        'unused-code': 180000,
        'dependency-analysis': 60000,
        'ts-coverage': 120000,
        'memory-leak': 180000,
      };

      return options.reduce((total, option) => {
        return total + (estimateMap[option] || 30000);
      }, 0);
    }),
    __setResults: jest
      .fn()
      .mockImplementation((newResults: Record<string, any>) => {
        resultStore = { ...newResults };
      }),
    __addAnalyzer: jest.fn().mockImplementation((analyzer: IAnalyzer) => {
      analyzers.push(analyzer);
    }),
    __clearAnalyzers: jest.fn().mockImplementation(() => {
      analyzers.length = 0;
    }),
  };
}
