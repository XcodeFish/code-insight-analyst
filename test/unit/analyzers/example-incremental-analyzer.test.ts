/* global jest, describe, it, expect, beforeEach */
import { ExampleIncrementalAnalyzer } from '../../../src/analyzers/example-incremental-analyzer';
import { AstService } from '../../../src/core/ast-service';
import fs from 'fs';
import { createMockAstService } from '../../../test/mocks/mock-ast-service';

// 模拟 AstService
jest.mock('../../../src/core/ast-service');

describe('ExampleIncrementalAnalyzer', () => {
  let analyzer: ExampleIncrementalAnalyzer;
  const projectPath = '/test/project';
  const changedFiles = ['/test/project/file1.ts'];
  let mockAstService: jest.Mocked<AstService>;

  beforeEach(() => {
    mockAstService = createMockAstService();
    analyzer = new ExampleIncrementalAnalyzer(projectPath, mockAstService);
  });

  describe('分析方法', () => {
    it('应执行完整分析', async () => {
      const mockCallback = jest.fn();
      const result = await analyzer.analyze(mockCallback);

      expect(result).toBeDefined();
      expect(result.type).toBe('example-analyzer');
      expect(mockCallback).toHaveBeenCalled();
    });

    it('应执行增量分析', async () => {
      const mockCallback = jest.fn();
      const result = await analyzer.analyzeIncremental(
        changedFiles,
        mockCallback
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('example-analyzer');
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应处理分析中的错误', async () => {
      // 注入错误用例
      const mockCallback = jest.fn();

      // 模拟文件读取失败
      jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
        throw new Error('读取失败');
      });

      const result = await analyzer.analyzeIncremental(
        ['/invalid/path.ts'],
        mockCallback
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });
});
