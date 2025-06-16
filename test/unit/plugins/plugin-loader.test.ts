import { PluginLoader } from '../../../src/plugins/loader';
import {
  IPlugin,
  PluginContext,
  PluginHookName,
} from '../../../src/plugins/types';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('PluginLoader', () => {
  let pluginLoader: PluginLoader;
  const mockPluginsDir = '/mock/plugins';

  // 模拟插件对象
  const mockPlugin1: IPlugin = {
    name: 'test-plugin-1',
    version: '1.0.0',
    description: '测试插件1',
    author: 'Test Author',
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockImplementation(async () => ({
      success: true,
      data: { result: 'test-plugin-1-result' },
    })),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  const mockPlugin2: IPlugin = {
    name: 'test-plugin-2',
    version: '1.0.0',
    description: '测试插件2',
    author: 'Test Author',
    initialize: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockImplementation(async () => ({
      success: true,
      data: { result: 'test-plugin-2-result' },
    })),
  };

  beforeEach(() => {
    // 重置所有模拟
    jest.resetAllMocks();

    // 模拟路径
    (path.join as jest.Mock).mockImplementation((...args) =>
      args.join('/').replace(/\/+/g, '/')
    );
    (path.dirname as jest.Mock).mockImplementation((p) =>
      p.split('/').slice(0, -1).join('/')
    );

    // 模拟文件系统
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.statSync as jest.Mock).mockImplementation(() => ({
      isDirectory: () => true,
    }));
    (fs.readdirSync as jest.Mock).mockReturnValue(['plugin1', 'plugin2']);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('plugin1')) {
        return JSON.stringify({
          name: 'test-plugin-1',
          version: '1.0.0',
          main: 'index.js',
        });
      } else {
        return JSON.stringify({
          name: 'test-plugin-2',
          version: '1.0.0',
          main: 'index.js',
        });
      }
    });

    // 模拟require
    jest.mock(
      '/mock/plugins/plugin1/index.js',
      () => ({
        default: mockPlugin1,
      }),
      { virtual: true }
    );
    jest.mock(
      '/mock/plugins/plugin2/index.js',
      () => ({
        default: mockPlugin2,
      }),
      { virtual: true }
    );

    // 创建插件加载器实例
    pluginLoader = new PluginLoader(mockPluginsDir);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应使用默认插件目录', () => {
      const defaultLoader = new PluginLoader();
      expect(path.join).toHaveBeenCalledWith(expect.any(String), 'plugins');
    });

    it('应使用提供的插件目录', () => {
      expect((pluginLoader as any).pluginsDir).toBe(mockPluginsDir);
    });
  });

  describe('插件加载', () => {
    it('应加载所有有效插件', async () => {
      await pluginLoader.initialize();

      // 验证插件被正确加载
      const plugins = pluginLoader.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('test-plugin-1');
      expect(plugins[1].name).toBe('test-plugin-2');

      // 验证插件初始化方法被调用
      expect(mockPlugin1.initialize).toHaveBeenCalled();
      expect(mockPlugin2.initialize).toHaveBeenCalled();
    });

    it('应跳过无效插件', async () => {
      // 模拟插件目录结构，但第二个插件无效
      (fs.readFileSync as jest.Mock).mockImplementation((filePath) => {
        if (filePath.includes('plugin1')) {
          return JSON.stringify({
            name: 'test-plugin-1',
            version: '1.0.0',
            main: 'index.js',
          });
        } else {
          return JSON.stringify({
            // 缺少必要字段
            name: 'test-plugin-2',
          });
        }
      });

      await pluginLoader.initialize();

      // 验证只加载了有效插件
      const plugins = pluginLoader.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin-1');
    });

    it('应从特定目录加载插件', async () => {
      const newDir = '/another/plugins/dir';

      // 重置模拟，为新目录设置不同的插件
      (fs.readdirSync as jest.Mock).mockReturnValue(['plugin3']);
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        return JSON.stringify({
          name: 'test-plugin-3',
          version: '1.0.0',
          main: 'index.js',
        });
      });

      const mockPlugin3 = {
        name: 'test-plugin-3',
        version: '1.0.0',
        description: '测试插件3',
        author: 'Test Author',
        initialize: jest.fn().mockResolvedValue(undefined),
        execute: jest.fn().mockResolvedValue({ success: true }),
      };

      jest.mock(
        '/another/plugins/dir/plugin3/index.js',
        () => ({
          default: mockPlugin3,
        }),
        { virtual: true }
      );

      await pluginLoader.loadFromDirectory(newDir);

      // 验证从新目录加载的插件
      const plugins = pluginLoader.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin-3');
    });

    it('应重新加载插件', async () => {
      // 先加载插件
      await pluginLoader.initialize();

      // 修改模拟，只保留一个插件
      (fs.readdirSync as jest.Mock).mockReturnValue(['plugin1']);

      // 重新加载
      await pluginLoader.reload();

      // 验证只剩一个插件，并且清理方法被调用
      const plugins = pluginLoader.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin-1');
      expect(mockPlugin1.cleanup).toHaveBeenCalled();
    });
  });

  describe('插件执行', () => {
    beforeEach(async () => {
      // 加载测试插件
      await pluginLoader.initialize();
    });

    it('应执行所有插件', async () => {
      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      const results = await pluginLoader.executePlugins(context);

      // 验证结果
      expect(results.size).toBe(2);
      expect(results.get('test-plugin-1')).toEqual({
        success: true,
        data: { result: 'test-plugin-1-result' },
      });
      expect(results.get('test-plugin-2')).toEqual({
        success: true,
        data: { result: 'test-plugin-2-result' },
      });

      // 验证执行方法被调用
      expect(mockPlugin1.execute).toHaveBeenCalledWith(context);
      expect(mockPlugin2.execute).toHaveBeenCalledWith(context);
    });

    it('应处理执行中的错误', async () => {
      // 模拟执行失败
      mockPlugin1.execute = jest
        .fn()
        .mockRejectedValue(new Error('插件执行失败'));

      const context = {
        projectPath: '/test/project',
        config: {},
        tools: {} as any,
        analysisResults: {},
      };

      const results = await pluginLoader.executePlugins(context);

      // 验证结果
      expect(results.size).toBe(2);
      expect(results.get('test-plugin-1')).toEqual({
        success: false,
        error: expect.stringContaining('插件执行错误'),
      });
    });
  });

  describe('钩子系统', () => {
    const context: PluginContext = {
      projectPath: '/test/project',
      config: {},
      tools: {} as any,
      analysisResults: {},
    };

    it('应注册和调用钩子', async () => {
      const hookHandler = jest.fn().mockImplementation(async (data) => {
        return { ...data, modified: true };
      });

      // 注册钩子
      pluginLoader.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        hookHandler,
        'test-plugin-1'
      );

      // 调用钩子
      const data = { original: true };
      const result = await pluginLoader.applyHooks(
        PluginHookName.BEFORE_ANALYSIS,
        data,
        context
      );

      // 验证结果
      expect(hookHandler).toHaveBeenCalledWith(data, context);
      expect(result).toEqual({ original: true, modified: true });
    });

    it('应按优先级调用多个钩子', async () => {
      const order: number[] = [];

      const hook1 = jest.fn().mockImplementation(async (data) => {
        order.push(1);
        return { ...data, hook1: true };
      });

      const hook2 = jest.fn().mockImplementation(async (data) => {
        order.push(2);
        return { ...data, hook2: true };
      });

      const hook3 = jest.fn().mockImplementation(async (data) => {
        order.push(3);
        return { ...data, hook3: true };
      });

      // 注册不同优先级的钩子
      pluginLoader.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        hook1,
        'test-plugin-1',
        10 // 默认优先级
      );

      pluginLoader.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        hook2,
        'test-plugin-2',
        5 // 较高优先级
      );

      pluginLoader.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        hook3,
        'test-plugin-3',
        20 // 较低优先级
      );

      // 调用钩子
      const data = { original: true };
      const result = await pluginLoader.applyHooks(
        PluginHookName.BEFORE_ANALYSIS,
        data,
        context
      );

      // 验证钩子调用顺序 (按优先级从高到低)
      expect(order).toEqual([2, 1, 3]);

      // 验证结果包含所有修改
      expect(result).toEqual({
        original: true,
        hook1: true,
        hook2: true,
        hook3: true,
      });
    });

    it('应使用invokeHook调用钩子', async () => {
      const hookHandler = jest.fn().mockImplementation(async (data) => {
        return { ...data, invoked: true };
      });

      // 注册钩子
      pluginLoader.registerHook(
        PluginHookName.BEFORE_ANALYSIS,
        hookHandler,
        'test-plugin-1'
      );

      // 使用invokeHook方法
      const data = { original: true };
      const result = await pluginLoader.invokeHook(
        PluginHookName.BEFORE_ANALYSIS,
        data,
        context
      );

      // 验证结果
      expect(hookHandler).toHaveBeenCalledWith(data, context);
      expect(result).toEqual({ original: true, invoked: true });
    });
  });

  describe('清理', () => {
    beforeEach(async () => {
      // 加载测试插件
      await pluginLoader.initialize();
    });

    it('应清理所有插件资源', async () => {
      await pluginLoader.cleanup();

      // 验证清理方法被调用
      expect(mockPlugin1.cleanup).toHaveBeenCalled();

      // 验证插件列表被清空
      expect(pluginLoader.getPlugins()).toHaveLength(0);
    });
  });

  describe('工具方法', () => {
    beforeEach(async () => {
      // 加载测试插件
      await pluginLoader.initialize();
    });

    it('应获取所有插件', () => {
      const plugins = pluginLoader.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('test-plugin-1');
      expect(plugins[1].name).toBe('test-plugin-2');
    });

    it('应获取特定插件', () => {
      const plugin = pluginLoader.getPlugin('test-plugin-1');
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin-1');

      // 不存在的插件
      const nonExistentPlugin = pluginLoader.getPlugin('non-existent');
      expect(nonExistentPlugin).toBeUndefined();
    });
  });
});
