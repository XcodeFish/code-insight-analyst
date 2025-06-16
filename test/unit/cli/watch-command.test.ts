import { WatchCommand } from '../../../src/cli/commands/watch-command';
import { AnalysisOrchestrator } from '../../../src/core/analysis-orchestrator';
import { ConfigManager } from '../../../src/utils/config-manager';
import { PluginManager } from '../../../src/plugins/manager';
import chokidar from 'chokidar';

// 模拟依赖
jest.mock('chokidar');
jest.mock('../../../src/core/analysis-orchestrator');
jest.mock('../../../src/utils/config-manager');
jest.mock('../../../src/plugins/manager');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
}));

describe('WatchCommand', () => {
  let watchCommand: WatchCommand;
  let mockOrchestrator: jest.Mocked<AnalysisOrchestrator>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockPluginManager: jest.Mocked<PluginManager>;
  let mockWatcher: any;
  const projectPath = '/test/project';

  beforeEach(() => {
    jest.resetAllMocks();

    // 模拟配置管理器
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    (mockConfigManager.get as jest.Mock).mockImplementation((key) => {
      if (key === 'watchMode') {
        return {
          enabled: true,
          interval: 2000,
          patterns: ['**/*.ts', '**/*.js'],
          exclude: ['**/node_modules/**', '**/dist/**'],
        };
      }
      return undefined;
    });

    // 模拟分析协调器
    mockOrchestrator =
      new AnalysisOrchestrator() as jest.Mocked<AnalysisOrchestrator>;
    (mockOrchestrator.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockOrchestrator.runIncremental as jest.Mock).mockResolvedValue([
      { type: 'test-result', data: { passed: 10, failed: 2 } },
    ]);

    // 模拟插件管理器
    mockPluginManager = new PluginManager() as jest.Mocked<PluginManager>;
    (mockPluginManager.initialize as jest.Mock).mockResolvedValue(undefined);

    // 模拟文件监控器
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      add: jest.fn(),
      unwatch: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (chokidar.watch as jest.Mock).mockReturnValue(mockWatcher);

    // 创建监控命令实例
    watchCommand = new WatchCommand(
      mockOrchestrator,
      mockConfigManager,
      mockPluginManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应加载监控配置', async () => {
      await watchCommand.execute({ projectPath });

      expect(mockConfigManager.get).toHaveBeenCalledWith('watchMode');
    });

    it('应初始化分析协调器和插件管理器', async () => {
      await watchCommand.execute({ projectPath });

      expect(mockOrchestrator.initialize).toHaveBeenCalled();
      expect(mockPluginManager.initialize).toHaveBeenCalled();
    });
  });

  describe('监控设置', () => {
    it('应使用配置的监控选项', async () => {
      await watchCommand.execute({ projectPath });

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['**/*.ts', '**/*.js'],
        expect.objectContaining({
          ignored: ['**/node_modules/**', '**/dist/**'],
          persistent: true,
        })
      );
    });

    it('应支持自定义选项覆盖', async () => {
      const options = {
        projectPath,
        patterns: ['**/*.tsx'],
        exclude: ['**/test/**'],
      };

      await watchCommand.execute(options);

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['**/*.tsx'],
        expect.objectContaining({
          ignored: ['**/test/**'],
          persistent: true,
        })
      );
    });
  });

  describe('文件变更处理', () => {
    beforeEach(async () => {
      // 执行命令以注册事件处理器
      await watchCommand.execute({ projectPath });
    });

    it('应响应文件变更事件', () => {
      // 获取注册的change事件处理器
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === 'change'
      )[1];

      // 模拟文件变更
      changeHandler('/test/project/src/file.ts');

      // 验证防抖定时器已设置
      expect(setTimeout).toHaveBeenCalled();
    });

    it('应防抖处理多次变更', () => {
      jest.useFakeTimers();

      // 获取注册的change事件处理器
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === 'change'
      )[1];

      // 模拟多次文件变更
      changeHandler('/test/project/src/file1.ts');
      changeHandler('/test/project/src/file2.ts');
      changeHandler('/test/project/src/file3.ts');

      // 快进所有定时器
      jest.runAllTimers();

      // 验证增量分析只执行一次
      expect(mockOrchestrator.runIncremental).toHaveBeenCalledTimes(1);

      // 验证分析包含所有变更文件
      expect(mockOrchestrator.runIncremental).toHaveBeenCalledWith(
        expect.any(Array),
        projectPath,
        expect.arrayContaining([
          '/test/project/src/file1.ts',
          '/test/project/src/file2.ts',
          '/test/project/src/file3.ts',
        ])
      );

      jest.useRealTimers();
    });
  });

  describe('插件集成', () => {
    it('应执行文件监控钩子', async () => {
      await watchCommand.execute({ projectPath });

      // 获取注册的change事件处理器
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === 'change'
      )[1];

      // 模拟文件变更并快进定时器
      jest.useFakeTimers();
      changeHandler('/test/project/src/file.ts');
      jest.runAllTimers();
      jest.useRealTimers();

      // 验证插件钩子被调用
      expect(mockPluginManager.invokeHook).toHaveBeenCalledWith(
        expect.stringMatching(/FILE_CHANGED/),
        expect.arrayContaining(['/test/project/src/file.ts']),
        expect.any(Object)
      );
    });
  });

  describe('结果处理', () => {
    beforeEach(async () => {
      await watchCommand.execute({ projectPath });
    });

    it('应处理增量分析结果', async () => {
      // 获取注册的change事件处理器
      const changeHandler = mockWatcher.on.mock.calls.find(
        (call) => call[0] === 'change'
      )[1];

      // 模拟文件变更并快进定时器
      jest.useFakeTimers();
      changeHandler('/test/project/src/file.ts');
      jest.runAllTimers();
      jest.useRealTimers();

      // 验证结果钩子被调用
      expect(mockPluginManager.invokeHook).toHaveBeenCalledWith(
        expect.stringMatching(/ANALYSIS_COMPLETE/),
        expect.arrayContaining([
          { type: 'test-result', data: { passed: 10, failed: 2 } },
        ]),
        expect.any(Object)
      );
    });
  });

  describe('停止监控', () => {
    it('应正确停止监控', async () => {
      // 启动监控
      await watchCommand.execute({ projectPath });

      // 停止监控
      await watchCommand.stop();

      // 验证监控已关闭
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
