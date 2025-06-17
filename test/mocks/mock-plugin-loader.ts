/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest */
/**
 * 模拟PluginLoader
 */
import {
  IPlugin,
  PluginContext,
  PluginHookName,
} from '../../src/plugins/types';

/**
 * 插件元数据接口
 */
interface IPluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
}

/**
 * 创建模拟插件加载器
 */
export function createMockPluginLoader() {
  // 插件存储
  const plugins = new Map<string, IPlugin>();
  const metadata = new Map<string, IPluginMetadata>();

  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    loadPlugins: jest.fn().mockImplementation(async () => {
      // 返回已加载的插件
      return Array.from(plugins.values());
    }),
    loadFromDirectory: jest
      .fn()
      .mockImplementation(async (directory: string) => {
        // 模拟从目录加载
        return Array.from(plugins.values());
      }),
    loadFromFile: jest.fn().mockImplementation(async (filePath: string) => {
      // 模拟加载单个插件文件
      return null;
    }),
    getPlugins: jest.fn().mockImplementation(() => {
      return Array.from(plugins.values());
    }),
    getPlugin: jest.fn().mockImplementation((name: string) => {
      return plugins.get(name);
    }),
    getPluginMetadata: jest.fn().mockImplementation((name: string) => {
      return metadata.get(name);
    }),
    getAllPluginMetadata: jest.fn().mockImplementation(() => {
      return Array.from(metadata.values());
    }),
    validatePlugin: jest.fn().mockImplementation((plugin: any) => {
      // 判断是否实现了所需接口
      if (
        typeof plugin !== 'object' ||
        typeof plugin.initialize !== 'function' ||
        typeof plugin.execute !== 'function'
      ) {
        return false;
      }
      return true;
    }),

    installPlugin: jest.fn().mockImplementation(async (packageName: string) => {
      return {
        success: true,
        message: `插件 ${packageName} 安装成功`,
      };
    }),
    uninstallPlugin: jest
      .fn()
      .mockImplementation(async (pluginName: string) => {
        if (plugins.has(pluginName)) {
          plugins.delete(pluginName);
          return {
            success: true,
            message: `插件 ${pluginName} 卸载成功`,
          };
        }
        return {
          success: false,
          message: `插件 ${pluginName} 不存在`,
        };
      }),
    cleanup: jest.fn().mockResolvedValue(undefined),
    // 测试辅助方法
    __addPlugin: jest
      .fn()
      .mockImplementation(
        (name: string, plugin: IPlugin, meta?: IPluginMetadata) => {
          plugins.set(name, plugin);
          if (meta) {
            metadata.set(name, meta);
          } else {
            metadata.set(name, {
              name,
              version: '1.0.0',
              description: `测试插件 ${name}`,
              author: 'Test Author',
              main: `${name}.js`,
            });
          }
        }
      ),
    __reset: jest.fn().mockImplementation(() => {
      plugins.clear();
      metadata.clear();
    }),
  };
}
