import { PluginManager } from '../../../src/plugins/manager';
import { PluginLoader } from '../../../src/plugins/loader';
import { IPlugin, PluginHookName } from '../../../src/plugins/types';
import { ConfigManager } from '../../../src/utils/config-manager';

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
    initialize: jest.fn(),
    execute: jest.fn(),
  };

  const mockPlugin2: IPlugin = {
    name: 'test-plugin-2',
    version: '1.0.0',
    description: '测试插件2',
    author: 'Test Author',
    initialize: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    // 设置ConfigManager模拟
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
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
    mockPluginLoader = new PluginLoader() as jest.Mocked<PluginLoader>;
    (mockPluginLoader.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockPluginLoader.getPlugins as jest.Mock).mockReturnValue([
      mockPlugin1,
      mockPlugin2,
    ]);
    (mockPluginLoader.getPlugin as jest.Mock).mockImplementation((name) => {
      if (name === 'test-plugin-1') return mockPlugin1;
      if (name === 'test-plugin-2') return mockPlugin2;
      return undefined;
    });
    (mockPluginLoader.executePlugins as jest.Mock).mockResolvedValue(
      new Map([
        ['test-plugin-1', { success: true, data: { result: 'result1' } }],
        ['test-plugin-2', { success: true, data: { result: 'result2' } }],
      ])
    );
    (mockPluginLoader.invokeHook as jest.Mock).mockImplementation(
      async (hookName, data) => {
        return { ...data, processed: true };
      }
    );

    // 创建PluginManager实例
    pluginManager = new PluginManager(mockPluginLoader, mockConfigManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应初始化插件加载器', async () => {
      await pluginManager.initialize();

      expect(mockPluginLoader.initialize).toHaveBeenCalled();
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

    it('应执行启用的插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.executePlugins(context);

      // 验证调用了pluginLoader.executePlugins
      expect(mockPluginLoader.executePlugins).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: '/test/project',
          config: expect.any(Object),
          tools: expect.any(Object),
          analysisResults: {},
        })
      );
    });

    it('应过滤禁用的插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.executePlugins(context);

      // 验证只有启用的插件被执行
      const plugins = await (pluginManager as any).getEnabledPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin-1');
    });

    it('应将插件选项传递给插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      await pluginManager.executePlugins(context);

      // 验证executePlugins调用包含插件选项
      expect(mockPluginLoader.executePlugins).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            plugins: expect.objectContaining({
              'test-plugin-1': expect.objectContaining({
                options: { key1: 'value1' },
              }),
            }),
          }),
        })
      );
    });
  });

  describe('钩子系统', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应注册钩子', () => {
      const mockHandler = jest.fn();

      pluginManager.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        mockHandler,
        'test-plugin-1'
      );

      expect(mockPluginLoader.registerHook).toHaveBeenCalledWith(
        PluginHookName.BEFORE_ANALYSIS,
        mockHandler,
        'test-plugin-1',
        undefined
      );
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
        expect.objectContaining({
          projectPath: '/test/project',
        })
      );
    });

    it('应在上下文中包含配置信息', async () => {
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
        expect.objectContaining({
          config: expect.objectContaining({
            plugins: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('插件管理', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应返回所有插件', () => {
      const plugins = pluginManager.getAllPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('test-plugin-1');
      expect(plugins[1].name).toBe('test-plugin-2');
    });

    it('应获取特定插件状态', () => {
      const plugin1Status = pluginManager.getPluginStatus('test-plugin-1');
      const plugin2Status = pluginManager.getPluginStatus('test-plugin-2');

      expect(plugin1Status).toEqual({
        enabled: true,
        options: { key1: 'value1' },
      });

      expect(plugin2Status).toEqual({
        enabled: false,
        options: { key2: 'value2' },
      });
    });

    it('应启用插件', () => {
      pluginManager.enablePlugin('test-plugin-2');

      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'plugins',
        expect.objectContaining({
          'test-plugin-2': expect.objectContaining({
            enabled: true,
          }),
        })
      );
    });

    it('应禁用插件', () => {
      pluginManager.disablePlugin('test-plugin-1');

      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'plugins',
        expect.objectContaining({
          'test-plugin-1': expect.objectContaining({
            enabled: false,
          }),
        })
      );
    });

    it('应设置插件选项', () => {
      const newOptions = { key1: 'new-value' };

      pluginManager.setPluginOptions('test-plugin-1', newOptions);

      expect(mockConfigManager.set).toHaveBeenCalledWith(
        'plugins',
        expect.objectContaining({
          'test-plugin-1': expect.objectContaining({
            options: newOptions,
          }),
        })
      );
    });
  });

  describe('工具方法', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应返回已启用的插件列表', async () => {
      const plugins = await (pluginManager as any).getEnabledPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin-1');
    });

    it('应处理插件配置中不存在的插件', async () => {
      // 模拟一个配置中不存在的插件
      const mockPlugin3 = {
        name: 'test-plugin-3',
        version: '1.0.0',
        description: '测试插件3',
        author: 'Test Author',
        initialize: jest.fn(),
        execute: jest.fn(),
      };

      (mockPluginLoader.getPlugins as jest.Mock).mockReturnValue([
        mockPlugin1,
        mockPlugin2,
        mockPlugin3,
      ]);

      // 重新初始化以刷新插件列表
      await pluginManager.initialize();

      // 新插件应该默认被启用
      const plugins = await (pluginManager as any).getEnabledPlugins();
      expect(plugins.some((p) => p.name === 'test-plugin-3')).toBe(true);
    });
  });

  describe('清理', () => {
    beforeEach(async () => {
      await pluginManager.initialize();
    });

    it('应清理插件资源', async () => {
      await pluginManager.cleanup();

      expect(mockPluginLoader.cleanup).toHaveBeenCalled();
    });
  });
});
