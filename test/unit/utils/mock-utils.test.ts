/* global jest, describe, it, expect, beforeEach, afterEach */
import {
  createMockFS,
  createMockPath,
  createMockConsole,
  wait,
} from '../../mock-utils';

describe('测试工具函数', () => {
  describe('createMockFS', () => {
    it('应创建模拟的文件系统', () => {
      const mockFS = createMockFS();

      // 验证方法存在
      expect(mockFS.existsSync).toBeDefined();
      expect(mockFS.readFileSync).toBeDefined();
      expect(mockFS.writeFileSync).toBeDefined();
      expect(mockFS.statSync).toBeDefined();
      expect(mockFS.readdirSync).toBeDefined();
      expect(mockFS.mkdirSync).toBeDefined();
      expect(mockFS.unlinkSync).toBeDefined();
      expect(mockFS.rmdirSync).toBeDefined();

      // 测试基本功能
      mockFS.__setFiles({
        '/test/file.txt': 'Hello World',
      });

      expect(mockFS.existsSync('/test/file.txt')).toBe(true);
      expect(mockFS.readFileSync('/test/file.txt')).toBe('Hello World');

      // 测试目录自动创建
      expect(mockFS.existsSync('/test')).toBe(true);
      expect(mockFS.statSync('/test').isDirectory()).toBe(true);
    });
  });

  describe('createMockPath', () => {
    it('应创建模拟的路径工具', () => {
      const mockPath = createMockPath();

      expect(mockPath.join('a', 'b', 'c')).toBe('a/b/c');
      expect(mockPath.dirname('a/b/c.txt')).toBe('a/b');
      expect(mockPath.basename('a/b/c.txt')).toBe('c.txt');
      expect(mockPath.basename('a/b/c.txt', '.txt')).toBe('c');
      expect(mockPath.extname('a/b/c.txt')).toBe('.txt');
    });
  });

  describe('createMockConsole', () => {
    it('应创建模拟的控制台', () => {
      const mockConsole = createMockConsole();

      mockConsole.log('test log');
      mockConsole.error('test error');
      mockConsole.warn('test warn');
      mockConsole.info('test info');

      expect(mockConsole.__getLogs()).toContain('test log');
      expect(mockConsole.__getErrors()).toContain('test error');
      expect(mockConsole.__getWarnings()).toContain('test warn');
      expect(mockConsole.__getInfos()).toContain('test info');

      mockConsole.__reset();

      expect(mockConsole.__getLogs().length).toBe(0);
    });
  });

  describe('wait', () => {
    it('应等待指定的毫秒数', async () => {
      const start = Date.now();
      await wait(100);
      const duration = Date.now() - start;

      // 允许一定的误差
      expect(duration).toBeGreaterThanOrEqual(95);
    });
  });
});
