/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest */
import { IPlugin } from '../../src/plugins/types';

/**
 * 插件执行结果接口
 */
interface IPluginExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 创建模拟插件管理器
 */
export function createMockPluginManager() {
  // 存储已注册的插件
  const plugins: IPlugin[] = [];
  const executionResults = new Map<string, IPluginExecutionResult>();
  const hookListeners: Record<string, Array<(data: any) => Promise<void>>> = {};

  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    loadPlugins: jest.fn().mockResolvedValue(plugins),
    getPlugins: jest.fn().mockReturnValue(plugins),
    executePlugin: jest
      .fn()
      .mockImplementation(async (pluginId: string, context: any) => {
        const plugin = plugins.find((p) => p.name === pluginId);
        if (!plugin) {
          return {
            success: false,
            error: `插件不存在: ${pluginId}`,
          };
        }

        try {
          const result = await plugin.execute(context);
          executionResults.set(pluginId, {
            success: true,
            data: result,
          });
          return executionResults.get(pluginId);
        } catch (error) {
          executionResults.set(pluginId, {
            success: false,
            error: `执行失败: ${error}`,
          });
          return executionResults.get(pluginId);
        }
      }),
    registerHook: jest
      .fn()
      .mockImplementation(
        (hookName: string, callback: (data: any) => Promise<void>) => {
          if (!hookListeners[hookName]) {
            hookListeners[hookName] = [];
          }
          hookListeners[hookName].push(callback);
        }
      ),
    executeHook: jest
      .fn()
      .mockImplementation(async (hookName: string, data: any) => {
        if (!hookListeners[hookName]) return;

        const results = [];
        for (const callback of hookListeners[hookName]) {
          try {
            results.push(await callback(data));
          } catch (error) {
            console.error(`执行钩子 ${hookName} 失败:`, error);
          }
        }
        return results;
      }),
    // 测试辅助方法
    __addPlugin: jest.fn().mockImplementation((plugin: IPlugin) => {
      plugins.push(plugin);
    }),
    __getResults: () => executionResults,
    __reset: jest.fn().mockImplementation(() => {
      plugins.length = 0;
      executionResults.clear();
      Object.keys(hookListeners).forEach((key) => {
        hookListeners[key] = [];
      });
    }),
  };
}
