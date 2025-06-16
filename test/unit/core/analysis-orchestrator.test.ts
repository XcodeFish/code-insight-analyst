import { AnalysisOrchestrator } from '../../../src/core/analysis-orchestrator';
import { IAnalyzer } from '../../../src/analyzers/types';
import { PluginManager } from '../../../src/plugins/manager';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/plugins/manager');

describe('AnalysisOrchestrator', () => {
  let analysisOrchestrator: AnalysisOrchestrator;
  let mockPluginManager: jest.Mocked<PluginManager>;

  // 模拟分析器
  const mockAnalyzer1: IAnalyzer = {
    id: 'analyzer1',
    name: '分析器1',
    description: '模拟分析器1',
    supportedFileTypes: ['.ts', '.js'],
    execute: jest.fn().mockImplementation(async () => ({
      type: 'analyzer1-result',
      data: { metric1: 10, metric2: 20 },
    })),
    supportsIncrementalAnalysis: false,
    analyzeIncrementally: jest.fn(),
  };

  const mockAnalyzer2: IAnalyzer = {
    id: 'analyzer2',
    name: '分析器2',
    description: '模拟分析器2',
    supportedFileTypes: ['.ts'],
    execute: jest.fn().mockImplementation(async () => ({
      type: 'analyzer2-result',
      data: { metric3: 30, metric4: 40 },
    })),
    supportsIncrementalAnalysis: true,
    analyzeIncrementally: jest.fn().mockImplementation(async () => ({
      type: 'analyzer2-incremental-result',
      data: { metric3: 5, metric4: 10 },
    })),
  };

  const mockAnalyzers = [mockAnalyzer1, mockAnalyzer2];

  beforeEach(() => {
    jest.resetAllMocks();

    // 模拟插件管理器
    mockPluginManager = new PluginManager() as jest.Mocked<PluginManager>;
    (mockPluginManager.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockPluginManager.invokeHook as jest.Mock).mockImplementation(
      async (hook, data) => data
    );

    // 模拟文件系统
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockImplementation(() => ({
      isDirectory: () => true,
    }));
    (fs.readdirSync as jest.Mock).mockReturnValue([
      'file1.ts',
      'file2.js',
      'file3.json',
    ]);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.extname as jest.Mock).mockImplementation((file) =>
      file.split('.').pop()
    );

    // 创建分析协调器实例
    analysisOrchestrator = new AnalysisOrchestrator(mockPluginManager);

    // 注册模拟分析器
    mockAnalyzers.forEach((analyzer) => {
      analysisOrchestrator.registerAnalyzer(analyzer);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应初始化插件管理器', async () => {
      await analysisOrchestrator.initialize();

      expect(mockPluginManager.initialize).toHaveBeenCalled();
    });
  });

  describe('分析器管理', () => {
    it('应注册和获取分析器', () => {
      const analyzers = analysisOrchestrator.getAnalyzers();

      expect(analyzers).toHaveLength(2);
      expect(analyzers).toContain(mockAnalyzer1);
      expect(analyzers).toContain(mockAnalyzer2);
    });

    it('应按ID获取分析器', () => {
      const analyzer = analysisOrchestrator.getAnalyzerById('analyzer1');

      expect(analyzer).toBe(mockAnalyzer1);

      const nonExistentAnalyzer =
        analysisOrchestrator.getAnalyzerById('non-existent');
      expect(nonExistentAnalyzer).toBeUndefined();
    });
  });

  describe('文件处理', () => {
    it('应收集项目文件', async () => {
      const projectPath = '/test/project';
      const files = await analysisOrchestrator.collectFiles(projectPath);

      expect(files).toHaveLength(3);
      expect(files).toContain('/test/project/file1.ts');
      expect(files).toContain('/test/project/file2.js');
      expect(files).toContain('/test/project/file3.json');

      expect(fs.readdirSync).toHaveBeenCalledWith(projectPath);
    });

    it('应按扩展名过滤文件', async () => {
      const projectPath = '/test/project';
      const files = await analysisOrchestrator.collectFiles(projectPath, [
        '.ts',
      ]);

      expect(files).toHaveLength(1);
      expect(files).toContain('/test/project/file1.ts');
    });

    it('应支持排除模式', async () => {
      const projectPath = '/test/project';
      const files = await analysisOrchestrator.collectFiles(
        projectPath,
        undefined,
        ['*.json']
      );

      expect(files).toHaveLength(2);
      expect(files).toContain('/test/project/file1.ts');
      expect(files).toContain('/test/project/file2.js');
      expect(files).not.toContain('/test/project/file3.json');
    });
  });

  describe('分析执行', () => {
    const projectPath = '/test/project';

    beforeEach(async () => {
      // 初始化
      await analysisOrchestrator.initialize();
    });

    it('应执行所有分析器', async () => {
      const results = await analysisOrchestrator.run(
        ['analyzer1', 'analyzer2'],
        projectPath
      );

      expect(results).toHaveLength(2);

      // 验证每个分析器都被调用
      expect(mockAnalyzer1.execute).toHaveBeenCalled();
      expect(mockAnalyzer2.execute).toHaveBeenCalled();

      // 验证结果
      expect(results[0].type).toBe('analyzer1-result');
      expect(results[1].type).toBe('analyzer2-result');
    });

    it('应通过插件钩子处理', async () => {
      await analysisOrchestrator.run(['analyzer1'], projectPath);

      // 验证插件钩子被调用
      expect(mockPluginManager.invokeHook).toHaveBeenCalledWith(
        expect.any(String), // BEFORE_ANALYSIS
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('应处理不存在的分析器ID', async () => {
      const results = await analysisOrchestrator.run(
        ['non-existent'],
        projectPath
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('增量分析', () => {
    const projectPath = '/test/project';
    const changedFiles = ['/test/project/file1.ts'];

    beforeEach(async () => {
      await analysisOrchestrator.initialize();
    });

    it('应执行支持增量分析的分析器', async () => {
      const results = await analysisOrchestrator.runIncremental(
        ['analyzer1', 'analyzer2'],
        projectPath,
        changedFiles
      );

      // 验证只有支持增量分析的分析器被增量执行
      expect(mockAnalyzer1.execute).toHaveBeenCalled(); // 不支持增量，使用完整分析
      expect(mockAnalyzer2.analyzeIncrementally).toHaveBeenCalled(); // 支持增量

      // 验证结果
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('analyzer1-result');
      expect(results[1].type).toBe('analyzer2-incremental-result');
    });

    it('应根据文件类型执行分析器', async () => {
      // 设置只更改JS文件
      const jsChanges = ['/test/project/file2.js'];

      const results = await analysisOrchestrator.runIncremental(
        ['analyzer1', 'analyzer2'],
        projectPath,
        jsChanges
      );

      // 只有支持JS文件的分析器被执行
      expect(mockAnalyzer1.execute).toHaveBeenCalled(); // 支持.js
      expect(mockAnalyzer2.analyzeIncrementally).not.toHaveBeenCalled(); // 不支持.js

      // 验证结果
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('analyzer1-result');
    });
  });

  describe('分析结果处理', () => {
    const projectPath = '/test/project';

    beforeEach(async () => {
      await analysisOrchestrator.initialize();
    });

    it('应合并多个分析结果', async () => {
      // 执行分析
      await analysisOrchestrator.run(['analyzer1', 'analyzer2'], projectPath);

      // 获取合并后的结果
      const mergedResults = analysisOrchestrator.getResults();

      // 验证结果包含所有分析器的数据
      expect(mergedResults).toHaveProperty('analyzer1-result');
      expect(mergedResults).toHaveProperty('analyzer2-result');
      expect(mergedResults['analyzer1-result']).toEqual({
        metric1: 10,
        metric2: 20,
      });
      expect(mergedResults['analyzer2-result']).toEqual({
        metric3: 30,
        metric4: 40,
      });
    });

    it('应清除之前的结果', async () => {
      // 执行分析
      await analysisOrchestrator.run(['analyzer1'], projectPath);

      // 清除结果
      analysisOrchestrator.clearResults();

      // 验证结果已清除
      const mergedResults = analysisOrchestrator.getResults();
      expect(Object.keys(mergedResults)).toHaveLength(0);
    });
  });
});
