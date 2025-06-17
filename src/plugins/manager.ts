import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/config-manager';
import { PluginLoader } from './loader';
import {
  IPlugin,
  PluginContext,
  PluginResult,
  PluginHookName,
  PluginTools,
} from './types';

const execAsync = promisify(exec);

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
   * @param pluginLoader 可选的插件加载器实例
   * @param configManager 可选的配置管理器实例
   */
  constructor(pluginLoader?: PluginLoader, configManager?: ConfigManager) {
    this.logger = new Logger();

    // 使用传入的实例或创建新实例
    this.configManager = configManager || new ConfigManager();

    // 用户插件目录
    this.userPluginsDir = path.join(os.homedir(), '.code-insight', 'plugins');

    // 系统插件目录（内置插件）
    this.systemPluginsDir = path.join(__dirname, '..', '..', 'plugins');

    // 使用传入的插件加载器或创建新的
    this.pluginLoader = pluginLoader || new PluginLoader();
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

      // 加载插件配置
      this.configManager.get('plugins');
      this.logger.debug('已加载插件配置');

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
   * 执行特定插件
   * @param pluginName 插件名称
   * @param context 插件上下文
   */
  public async executePlugin(
    pluginName: string,
    context: PluginContext
  ): Promise<PluginResult | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      this.logger.warn(`插件不存在: ${pluginName}`);
      return null;
    }

    try {
      this.logger.debug(`执行插件: ${plugin.name}`);
      const result = await plugin.execute(context);
      return {
        ...result,
        pluginName: plugin.name,
      };
    } catch (error) {
      this.logger.error(`插件 ${plugin.name} 执行失败:`, error);
      return {
        success: false,
        pluginName: plugin.name,
        error: `执行失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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

      // 确保用户插件目录存在
      await fs.ensureDir(this.userPluginsDir);

      let pluginInstallPath = '';

      // 判断是本地路径还是npm包名
      if (
        fs.existsSync(pluginPath) &&
        (await fs.stat(pluginPath)).isDirectory()
      ) {
        // 本地路径，复制到用户插件目录
        const pluginName = path.basename(pluginPath);
        pluginInstallPath = path.join(this.userPluginsDir, pluginName);

        // 检查是否已存在同名插件
        if (fs.existsSync(pluginInstallPath)) {
          this.logger.warn(`已存在同名插件: ${pluginName}`);
          return false;
        }

        // 复制插件目录
        await fs.copy(pluginPath, pluginInstallPath);
        this.logger.info(`插件复制完成: ${pluginName}`);
      } else {
        // npm包名，使用npm安装
        try {
          const tempDir = path.join(os.tmpdir(), 'code-insight-plugins');
          await fs.ensureDir(tempDir);

          // 在临时目录安装npm包
          this.logger.debug(`在临时目录安装npm包: ${tempDir}`);
          const { stdout } = await execAsync(
            `cd "${tempDir}" && npm install ${pluginPath}`
          );
          this.logger.debug(`npm安装输出: ${stdout}`);

          // 查找安装的包
          const nodeModulesDir = path.join(tempDir, 'node_modules');
          const packagePath = path.join(nodeModulesDir, pluginPath);

          if (!fs.existsSync(packagePath)) {
            throw new Error(`找不到安装的包: ${pluginPath}`);
          }

          // 复制到插件目录
          const pluginName = path.basename(pluginPath);
          pluginInstallPath = path.join(this.userPluginsDir, pluginName);

          // 检查是否已存在同名插件
          if (fs.existsSync(pluginInstallPath)) {
            this.logger.warn(`已存在同名插件: ${pluginName}`);
            return false;
          }

          await fs.copy(packagePath, pluginInstallPath);
          this.logger.info(`npm包安装完成: ${pluginName}`);

          // 清理临时目录
          await fs.remove(tempDir);
        } catch (npmError) {
          throw new Error(
            `npm安装失败: ${npmError instanceof Error ? npmError.message : String(npmError)}`
          );
        }
      }

      // 安装后重新加载插件
      await this.pluginLoader.loadFromDirectory(this.userPluginsDir);

      // 通知插件安装事件
      const installedPlugin = this.getPlugin(path.basename(pluginPath));
      if (installedPlugin) {
        const context: PluginContext = {
          projectPath: process.cwd(),
          config: this.configManager.getConfig(),
          tools: this.createPluginTools(),
          analysisResults: {},
        };
        await this.invokeHook(
          PluginHookName.PLUGIN_INSTALLED,
          {
            pluginName: installedPlugin.name,
            pluginVersion: installedPlugin.version,
            pluginPath: pluginInstallPath,
          },
          context
        );
      }

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

      // 先保存一些插件信息，供卸载后通知
      const pluginInfo = {
        name: plugin.name,
        version: plugin.version,
      };

      // 先清理插件资源
      if (plugin.cleanup) {
        await plugin.cleanup();
      }

      // 查找插件目录
      const pluginDir = path.join(this.userPluginsDir, pluginName);
      if (fs.existsSync(pluginDir)) {
        // 删除插件目录
        await fs.remove(pluginDir);
        this.logger.info(`已删除插件目录: ${pluginDir}`);
      } else {
        this.logger.warn(`未找到插件目录: ${pluginDir}`);
      }

      // 重新加载插件
      await this.pluginLoader.reload();

      // 通知插件卸载事件
      const context: PluginContext = {
        projectPath: process.cwd(),
        config: this.configManager.getConfig(),
        tools: this.createPluginTools(),
        analysisResults: {},
      };
      await this.invokeHook(
        PluginHookName.PLUGIN_UNINSTALLED,
        {
          pluginName: pluginInfo.name,
          pluginVersion: pluginInfo.version,
        },
        context
      );

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

    // 通知配置更改事件
    const context: PluginContext = {
      projectPath: process.cwd(),
      config: this.configManager.getConfig(),
      tools: this.createPluginTools(),
      analysisResults: {},
    };
    this.invokeHook(
      PluginHookName.CONFIG_CHANGE,
      {
        pluginName,
        newConfig: config,
      },
      context
    ).catch((error) => {
      this.logger.error(`通知配置更改事件失败:`, error);
    });
  }

  /**
   * 创建插件工具
   */
  private createPluginTools(): PluginTools {
    return {
      logger: {
        info: (message: string) => this.logger.info(message),
        warn: (message: string) => this.logger.warn(message),
        error: (message: string) => this.logger.error(message),
        debug: (message: string) => this.logger.debug(message),
      },
      fs: {
        readFile: async (filePath: string): Promise<string> => {
          return fs.readFile(filePath, 'utf8');
        },
        writeFile: async (filePath: string, content: string): Promise<void> => {
          return fs.writeFile(filePath, content);
        },
        exists: async (filePath: string): Promise<boolean> => {
          return fs.pathExists(filePath);
        },
        listFiles: async (/* pattern: string | string[] */): Promise<
          string[]
        > => {
          // 这里应该实现文件列表功能，但为简化，返回空数组
          return [];
        },
      },
      parser: {
        parseTypeScript: (/* code: string */): Record<string, unknown> => {
          // 这里应该实现TypeScript解析功能
          return {};
        },
        parseJavaScript: (/* code: string */): Record<string, unknown> => {
          // 这里应该实现JavaScript解析功能
          return {};
        },
      },
    };
  }

  /**
   * 清理插件资源
   */
  public async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('正在清理插件资源...');
    const plugins = this.pluginLoader.getPlugins();

    for (const plugin of plugins) {
      try {
        if (typeof plugin.cleanup === 'function') {
          await plugin.cleanup();
        }
      } catch (error) {
        this.logger.error(`插件 ${plugin.name} 清理失败:`, error);
      }
    }

    this.isInitialized = false;
    this.logger.info('插件资源清理完成');
  }
}
