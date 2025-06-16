import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/config-manager';
import { PluginLoader } from './loader';
import { IPlugin, PluginContext, PluginResult, PluginHookName } from './types';

/**
 * 插件管理器类
 * 负责管理插件的生命周期和调度
 */
export class PluginManager {
  private logger: Logger;
  private configManager: ConfigManager;
  private pluginLoader: PluginLoader;
  private userPluginsDir: string;
  private systemPluginsDir: string;
  private isInitialized: boolean = false;

  /**
   * 构造函数
   */
  constructor() {
    this.logger = new Logger();
    this.configManager = new ConfigManager();

    // 用户插件目录
    this.userPluginsDir = path.join(os.homedir(), '.code-insight', 'plugins');

    // 系统插件目录（内置插件）
    this.systemPluginsDir = path.join(__dirname, '..', '..', 'plugins');

    // 创建插件加载器
    this.pluginLoader = new PluginLoader();
  }

  /**
   * 初始化插件管理器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('初始化插件管理器...');

      // 确保用户插件目录存在
      await fs.ensureDir(this.userPluginsDir);

      // 加载系统插件
      if (fs.existsSync(this.systemPluginsDir)) {
        this.logger.debug(`加载系统插件: ${this.systemPluginsDir}`);
        await this.pluginLoader.loadFromDirectory(this.systemPluginsDir);
      }

      // 加载用户插件
      this.logger.debug(`加载用户插件: ${this.userPluginsDir}`);
      await this.pluginLoader.loadFromDirectory(this.userPluginsDir);

      const plugins = this.pluginLoader.getPlugins();
      this.logger.info(`插件加载完成，共 ${plugins.length} 个插件`);

      this.isInitialized = true;
    } catch (error) {
      this.logger.error('初始化插件管理器失败:', error);
      throw new Error(
        `插件管理器初始化失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取已加载的插件列表
   */
  public getPlugins(): IPlugin[] {
    return this.pluginLoader.getPlugins();
  }

  /**
   * 获取特定插件
   * @param name 插件名称
   */
  public getPlugin(name: string): IPlugin | undefined {
    return this.pluginLoader.getPlugin(name);
  }

  /**
   * 执行所有插件
   * @param context 插件上下文
   */
  public async executeAllPlugins(
    context: PluginContext
  ): Promise<PluginResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const plugins = this.pluginLoader.getPlugins();
    const results: PluginResult[] = [];

    for (const plugin of plugins) {
      try {
        this.logger.debug(`执行插件: ${plugin.name}`);
        const result = await plugin.execute(context);
        results.push({
          ...result,
          pluginName: plugin.name,
        });
      } catch (error) {
        this.logger.error(`插件 ${plugin.name} 执行失败:`, error);
        results.push({
          success: false,
          pluginName: plugin.name,
          error: `执行失败: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  /**
   * 调用特定插件钩子
   * @param hookName 钩子名称
   * @param data 钩子数据
   * @param context 插件上下文
   */
  public async invokeHook<T>(
    hookName: PluginHookName,
    data: T,
    context: PluginContext
  ): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.pluginLoader.invokeHook(hookName, data, context);
  }

  /**
   * 安装插件
   * @param pluginPath 插件路径或npm包名
   */
  public async installPlugin(pluginPath: string): Promise<boolean> {
    try {
      this.logger.info(`正在安装插件: ${pluginPath}`);

      // TODO: 实现插件安装逻辑
      // 如果是本地路径，复制到用户插件目录
      // 如果是npm包名，使用npm安装

      // 安装后重新加载插件
      await this.pluginLoader.loadFromDirectory(this.userPluginsDir);

      return true;
    } catch (error) {
      this.logger.error(`安装插件失败: ${pluginPath}`, error);
      return false;
    }
  }

  /**
   * 卸载插件
   * @param pluginName 插件名称
   */
  public async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      this.logger.info(`正在卸载插件: ${pluginName}`);

      const plugin = this.getPlugin(pluginName);
      if (!plugin) {
        this.logger.warn(`插件不存在: ${pluginName}`);
        return false;
      }

      // 先清理插件资源
      if (plugin.cleanup) {
        await plugin.cleanup();
      }

      // TODO: 删除插件目录

      // 重新加载插件
      await this.pluginLoader.reload();

      return true;
    } catch (error) {
      this.logger.error(`卸载插件失败: ${pluginName}`, error);
      return false;
    }
  }

  /**
   * 获取插件配置
   * @param pluginName 插件名称
   */
  public getPluginConfig(pluginName: string): Record<string, any> {
    const plugins = this.configManager.get('plugins');
    if (!plugins) return {};
    return (plugins as Record<string, any>)[pluginName] || {};
  }

  /**
   * 更新插件配置
   * @param pluginName 插件名称
   * @param config 插件配置
   */
  public updatePluginConfig(
    pluginName: string,
    config: Record<string, any>
  ): void {
    const plugins =
      (this.configManager.get('plugins') as Record<string, any>) || {};
    plugins[pluginName] = config;
    this.configManager.set('plugins', plugins);
  }
}
