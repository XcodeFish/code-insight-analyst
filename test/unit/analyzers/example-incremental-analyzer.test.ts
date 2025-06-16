import { ExampleIncrementalAnalyzer } from '../../../src/analyzers/example-incremental-analyzer';

describe('ExampleIncrementalAnalyzer', () => {
  let analyzer: ExampleIncrementalAnalyzer;
  const projectPath = '/test/project';
  const files = ['/test/project/file1.ts', '/test/project/file2.js'];
  const changedFiles = ['/test/project/file1.ts'];

  beforeEach(() => {
    analyzer = new ExampleIncrementalAnalyzer();
  });

  describe('基本属性', () => {
    it('应有正确的ID和名称', () => {
      expect(analyzer.id).toBe('example-incremental');
      expect(analyzer.name).toBe('示例增量分析器');
    });

    it('应支持增量分析', () => {
      expect(analyzer.supportsIncrementalAnalysis).toBe(true);
    });

    it('应支持多种文件类型', () => {
      expect(analyzer.supportedFileTypes).toContain('.ts');
      expect(analyzer.supportedFileTypes).toContain('.js');
    });
  });

  describe('分析方法', () => {
    it('应执行完整分析', async () => {
      const result = await analyzer.execute(projectPath, files);

      expect(result).toBeDefined();
      expect(result.type).toBe('example-analysis');
      expect(result.data).toHaveProperty('fullAnalysis', true);
      expect(result.data).toHaveProperty('fileCount', files.length);
    });

    it('应执行增量分析', async () => {
      const result = await analyzer.analyzeIncrementally(
        projectPath,
        files,
        changedFiles
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('example-analysis');
      expect(result.data).toHaveProperty('fullAnalysis', false);
      expect(result.data).toHaveProperty('fileCount', files.length);
      expect(result.data).toHaveProperty(
        'changedFileCount',
        changedFiles.length
      );
    });
  });

  describe('错误处理', () => {
    it('应处理分析中的错误', async () => {
      // 注入错误用例
      const invalidPath = null;

      // 应该正常返回结果而不是抛出错误
      const result = await analyzer.execute(invalidPath as any, files);

      expect(result).toBeDefined();
      expect(result.data).toHaveProperty('error');
    });
  });
});
