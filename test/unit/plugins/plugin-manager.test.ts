/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest, describe, it, expect, beforeEach, afterEach */
import { PluginManager } from '../../../src/plugins/manager';
import { PluginLoader } from '../../../src/plugins/loader';
import { IPlugin, PluginHookName } from '../../../src/plugins/types';
import { ConfigManager } from '../../../src/utils/config-manager';
import { createMockConfigManager } from '../../mocks/mock-config-manager';

// 模拟依赖
jest.mock('../../../src/plugins/loader');
jest.mock('../../../src/utils/config-manager');

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockPluginLoader: jest.Mocked<PluginLoader>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  // 模拟插件对象
  const mockPlugin1: IPlugin = {
    name: 'test-plugin-1',
    version: '1.0.0',
    description: '测试插件1',
    author: 'Test Author',
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest
      .fn()
      .mockResolvedValue({ success: true, data: { result: 'result1' } }),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlugin2: IPlugin = {
    name: 'test-plugin-2',
    version: '1.0.0',
    description: '测试插件2',
    author: 'Test Author',
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest
      .fn()
      .mockResolvedValue({ success: true, data: { result: 'result2' } }),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    // 设置ConfigManager模拟
    mockConfigManager = createMockConfigManager();
    (mockConfigManager.get as jest.Mock).mockImplementation((key) => {
      if (key === 'plugins') {
        return {
          'test-plugin-1': {
            enabled: true,
            options: { key1: 'value1' },
          },
          'test-plugin-2': {
            enabled: false,
            options: { key2: 'value2' },
          },
        };
      }
      return undefined;
    });

    // 设置PluginLoader模拟
    mockPluginLoader = {
      initialize: jest.fn().mockResolvedValue(undefined),
      loadFromDirectory: jest.fn().mockResolvedValue(undefined),
      getPlugins: jest.fn().mockReturnValue([mockPlugin1, mockPlugin2]),
      getPlugin: jest.fn().mockImplementation((name) => {
        if (name === 'test-plugin-1') return mockPlugin1;
        if (name === 'test-plugin-2') return mockPlugin2;
        return undefined;
      }),
      executePlugins: jest.fn().mockResolvedValue(
        new Map([
          ['test-plugin-1', { success: true, data: { result: 'result1' } }],
          ['test-plugin-2', { success: true, data: { result: 'result2' } }],
        ])
      ),
      invokeHook: jest.fn().mockImplementation(async (hookName, data) => {
        return { ...data, processed: true };
      }),
      registerHook: jest.fn(),
      applyHooks: jest.fn().mockImplementation(async (hookName, data) => data),
      cleanup: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PluginLoader>;

    // 替换构造函数
    (PluginLoader as jest.Mock).mockImplementation(() => mockPluginLoader);
    (ConfigManager as jest.Mock).mockImplementation(() => mockConfigManager);

    // 创建PluginManager实例
    pluginManager = new PluginManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应初始化插件加载器', async () => {
      await pluginManager.initialize();

      expect(mockPluginLoader.loadFromDirectory).toHaveBeenCalled();
    });

    it('应加载插件配置', async () => {
      await pluginManager.initialize();

      expect(mockConfigManager.get).toHaveBeenCalledWith('plugins');
    });
  });

  describe('插件执行', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应执行所有插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.executeAllPlugins(context);

      // 验证所有插件都被执行
      expect(mockPlugin1.execute).toHaveBeenCalled();
      expect(mockPlugin2.execute).toHaveBeenCalled();
    });

    it('应执行特定插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.executePlugin('test-plugin-1', context);

      // 验证特定插件被执行
      expect(mockPlugin1.execute).toHaveBeenCalled();
      expect(mockPlugin2.execute).not.toHaveBeenCalled();
    });

    it('应处理不存在的插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      const result = await pluginManager.executePlugin(
        'non-existent-plugin',
        context
      );

      expect(result).toBeNull();
    });
  });

  describe('钩子系统', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应调用钩子并传递上下文', async () => {
      const data = { test: true };
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.invokeHook(
        PluginHookName.BEFORE_ANALYSIS,
        data,
        context
      );

      expect(mockPluginLoader.invokeHook).toHaveBeenCalledWith(
        PluginHookName.BEFORE_ANALYSIS,
        data,
        expect.any(Object)
      );
    });
  });

  describe('插件管理', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应返回所有插件', () => {
      const plugins = pluginManager.getPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('test-plugin-1');
      expect(plugins[1].name).toBe('test-plugin-2');
    });

    it('应返回特定插件', () => {
      const plugin = pluginManager.getPlugin('test-plugin-1');

      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin-1');
    });

    it('应返回null对于不存在的插件', () => {
      const plugin = pluginManager.getPlugin('non-existent-plugin');

      expect(plugin).toBeUndefined();
    });

    it('应获取插件配置', () => {
      const config = pluginManager.getPluginConfig('test-plugin-1');

      expect(config).toBeDefined();
      expect(config).toEqual({
        enabled: true,
        options: { key1: 'value1' },
      });
    });

    it('应更新插件配置', () => {
      const newConfig = {
        enabled: false,
        options: { key1: 'new-value' },
      };

      pluginManager.updatePluginConfig('test-plugin-1', newConfig);

      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'plugins',
        expect.objectContaining({
          'test-plugin-1': newConfig,
        })
      );
    });
  });

  describe('清理', () => {
    it('应清理所有插件', async () => {
      await pluginManager.initialize();
      await pluginManager.cleanup();

      expect(mockPlugin1.cleanup).toHaveBeenCalled();
      expect(mockPlugin2.cleanup).toHaveBeenCalled();
    });
  });
});
