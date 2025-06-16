import * as path from 'path';
import * as fs from 'fs';
import {
  IPlugin,
  PluginMetadata,
  PluginContext,
  PluginResult,
  PluginHookName,
  PluginHook,
} from './types';

/**
 * 插件加载器类
 * 负责加载、管理和执行插件
 */
export class PluginLoader {
  /**
   * 已加载的插件
   */
  private plugins: Map<string, IPlugin> = new Map();

  /**
   * 注册的钩子
   */
  private hooks: Map<string, PluginHook[]> = new Map();

  /**
   * 插件目录路径
   */
  private pluginsDir: string;

  /**
   * 构造函数
   *
   * @param pluginsDir - 插件目录路径
   */
  constructor(pluginsDir?: string) {
    // 默认为项目根目录下的plugins文件夹
    this.pluginsDir = pluginsDir || path.join(process.cwd(), 'plugins');
  }

  /**
   * 初始化插件加载器
   */
  public async initialize(): Promise<void> {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }

    // 加载所有插件
    await this.loadPlugins();
  }

  /**
   * 加载所有插件
   */
  private async loadPlugins(): Promise<void> {
    // 获取所有插件目录
    const dirs = fs.readdirSync(this.pluginsDir).filter((dir) => {
      return fs.statSync(path.join(this.pluginsDir, dir)).isDirectory();
    });

    for (const dir of dirs) {
      try {
        const pluginPath = path.join(this.pluginsDir, dir);
        const metadataPath = path.join(pluginPath, 'package.json');

        // 检查是否存在package.json
        if (!fs.existsSync(metadataPath)) {
          console.warn(`插件 ${dir} 缺少package.json文件，已跳过`);
          continue;
        }

        // 解析插件元数据
        const metadata = JSON.parse(
          fs.readFileSync(metadataPath, 'utf8')
        ) as PluginMetadata;

        // 检查必要字段
        if (!metadata.name || !metadata.version || !metadata.main) {
          console.warn(`插件 ${dir} 的package.json缺少必要字段，已跳过`);
          continue;
        }

        // 加载插件主模块
        const mainPath = path.join(pluginPath, metadata.main);
        if (!fs.existsSync(mainPath)) {
          console.warn(
            `插件 ${dir} 的入口文件 ${metadata.main} 不存在，已跳过`
          );
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pluginModule = require(mainPath);

        // 检查是否实现了IPlugin接口
        if (
          !pluginModule.default ||
          typeof pluginModule.default !== 'object' ||
          typeof pluginModule.default.initialize !== 'function' ||
          typeof pluginModule.default.execute !== 'function'
        ) {
          console.warn(`插件 ${dir} 没有正确实现IPlugin接口，已跳过`);
          continue;
        }

        const plugin: IPlugin = pluginModule.default;

        // 初始化插件
        await plugin.initialize();

        // 保存插件实例
        this.plugins.set(metadata.name, plugin);

        console.info(`成功加载插件: ${plugin.name} v${plugin.version}`);
      } catch (error) {
        console.error(`加载插件 ${dir} 出错: ${error}`);
      }
    }
  }

  /**
   * 注册钩子
   *
   * @param hookName - 钩子名称
   * @param handler - 处理函数
   * @param pluginName - 插件名称
   * @param priority - 优先级
   */
  public registerHook<T>(
    hookName: PluginHookName | string,
    handler: (data: T, context: PluginContext) => Promise<T>,
    pluginName: string,
    priority: number = 10
  ): void {
    const hook: PluginHook<T> = {
      name: hookName,
      handler,
      priority,
    };

    // 获取或创建钩子数组
    const hooks = this.hooks.get(hookName) || [];
    hooks.push(hook);

    // 按优先级排序
    hooks.sort((a, b) => (a.priority || 10) - (b.priority || 10));

    // 保存钩子数组
    this.hooks.set(hookName, hooks);
  }

  /**
   * 调用钩子
   *
   * @param hookName - 钩子名称
   * @param data - 数据
   * @param context - 插件上下文
   * @returns 处理后的数据
   */
  public async applyHooks<T>(
    hookName: PluginHookName | string,
    data: T,
    context: PluginContext
  ): Promise<T> {
    const hooks = this.hooks.get(hookName) || [];
    let result = data;

    for (const hook of hooks) {
      try {
        result = await hook.handler(result, context);
      } catch (error) {
        console.error(`执行钩子 ${hookName} 出错: ${error}`);
      }
    }

    return result;
  }

  /**
   * 执行所有插件
   *
   * @param context - 插件上下文
   * @returns 执行结果
   */
  public async executePlugins(
    context: PluginContext
  ): Promise<Map<string, PluginResult>> {
    const results = new Map<string, PluginResult>();

    for (const [name, plugin] of this.plugins.entries()) {
      try {
        const result = await plugin.execute(context);
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          success: false,
          error: `插件执行错误: ${error}`,
        });
      }
    }

    return results;
  }

  /**
   * 清理所有插件资源
   */
  public async cleanup(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
        } catch (error) {
          console.error(`清理插件 ${plugin.name} 资源时出错: ${error}`);
        }
      }
    }

    this.plugins.clear();
    this.hooks.clear();
  }

  /**
   * 获取所有已加载的插件
   *
   * @returns 插件列表
   */
  public getPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取特定插件
   *
   * @param name - 插件名称
   * @returns 插件实例（如果存在）
   */
  public getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }
}
