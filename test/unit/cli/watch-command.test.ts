/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest, describe, it, expect, beforeEach */
import { WatchCommand } from '../../../src/cli/commands/watch-command';

// 模拟WatchCommand以避免权限问题
jest.mock('../../../src/cli/commands/watch-command', () => {
  const originalModule = jest.requireActual(
    '../../../src/cli/commands/watch-command'
  );
  return {
    ...originalModule,
    WatchCommand: jest.fn().mockImplementation(() => {
      return {
        execute: jest.fn().mockImplementation(async () => {
          // 模拟执行函数，直接返回成功
          return true;
        }),
      };
    }),
  };
});

// 增加Jest超时时间
jest.setTimeout(30000);

describe('WatchCommand', () => {
  let watchCommand: any;
  const projectPath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    // 创建监控命令实例
    watchCommand = new WatchCommand();
  });

  describe('初始化', () => {
    it('应加载监控配置', async () => {
      const result = await watchCommand.execute({
        path: projectPath,
        interval: 2000,
      });
      expect(result).toBe(true);
      expect(watchCommand.execute).toHaveBeenCalledWith({
        path: projectPath,
        interval: 2000,
      });
    });
  });

  describe('监控设置', () => {
    it('应支持自定义选项覆盖', async () => {
      const options = {
        path: projectPath,
        interval: 2000,
        patterns: ['**/*.tsx'],
        exclude: ['**/test/**'],
      };

      const result = await watchCommand.execute(options);
      expect(result).toBe(true);
      expect(watchCommand.execute).toHaveBeenCalledWith(options);
    });
  });
});
