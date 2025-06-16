import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Logger } from './logger';

/**
 * 配置接口
 */
export interface IConfig {
  permissions?: Record<string, boolean>;
  lastUsedOptions?: string[];
  preferredMode?: string;
  analyzers?: Record<string, unknown>;
  plugins?: Record<string, any>;
  watchMode?: {
    enabled: boolean;
    interval: number;
    patterns?: string[];
    exclude?: string[];
    analyzers?: string[];
  };
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private configPath: string;
  private config: IConfig;
  private logger: Logger;
  private configDir: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.code-insight');
    this.configPath = path.join(this.configDir, 'config.json');
    this.logger = new Logger();
    this.config = {};

    this.init();
  }

  /**
   * 初始化
   */
  private init(): void {
    try {
      // 确保配置目录存在
      fs.ensureDirSync(this.configDir);

      // 加载配置
      if (fs.existsSync(this.configPath)) {
        this.config = fs.readJsonSync(this.configPath);
      } else {
        // 初始化默认配置
        this.config = {
          permissions: {},
          lastUsedOptions: [],
          preferredMode: 'single',
          analyzers: {},
          plugins: {},
          watchMode: {
            enabled: false,
            interval: 5000, // 5秒
            patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            exclude: [
              '**/node_modules/**',
              '**/dist/**',
              '**/build/**',
              '**/.git/**',
            ],
            analyzers: [],
          },
        };
        this.saveConfig();
      }
    } catch (error) {
      this.logger.error('初始化配置管理器失败:', error);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): IConfig {
    return this.config;
  }

  /**
   * 获取特定配置项
   */
  get<T>(key: keyof IConfig): T | undefined {
    return this.config[key] as T | undefined;
  }

  /**
   * 设置特定配置项
   */
  set<T>(key: keyof IConfig, value: T): void {
    this.config[key] = value as any;
    this.saveConfig();
  }

  /**
   * 设置上次使用的选项
   */
  setLastUsedOptions(options: string[]): void {
    this.config.lastUsedOptions = options;
    this.saveConfig();
  }

  /**
   * 设置首选模式
   */
  setPreferredMode(mode: string): void {
    this.config.preferredMode = mode;
    this.saveConfig();
  }

  /**
   * 保存配置
   */
  saveConfig(): void {
    try {
      fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      this.logger.error('保存配置失败:', error);
    }
  }

  /**
   * 重置配置
   */
  resetConfig(): void {
    this.config = {
      permissions: {},
      lastUsedOptions: [],
      preferredMode: 'single',
      analyzers: {},
      plugins: {},
      watchMode: {
        enabled: false,
        interval: 5000,
        patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
        ],
        analyzers: [],
      },
    };
    this.saveConfig();
  }

  /**
   * 更新监测模式配置
   * @param watchConfig 监测模式配置
   */
  updateWatchConfig(watchConfig: Partial<IConfig['watchMode']> = {}): void {
    if (!this.config.watchMode) {
      this.config.watchMode = {
        enabled: false,
        interval: 5000,
        patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
        ],
        analyzers: [],
      };
    }

    this.config.watchMode = {
      enabled:
        typeof watchConfig.enabled === 'boolean'
          ? watchConfig.enabled
          : this.config.watchMode.enabled,
      interval:
        typeof watchConfig.interval === 'number'
          ? watchConfig.interval
          : this.config.watchMode.interval,
      patterns: watchConfig.patterns || this.config.watchMode.patterns,
      exclude: watchConfig.exclude || this.config.watchMode.exclude,
      analyzers: watchConfig.analyzers || this.config.watchMode.analyzers,
    };

    this.saveConfig();
  }

  /**
   * 启用监测模式
   */
  enableWatchMode(): void {
    if (this.config.watchMode) {
      this.config.watchMode.enabled = true;
      this.saveConfig();
    }
  }

  /**
   * 禁用监测模式
   */
  disableWatchMode(): void {
    if (this.config.watchMode) {
      this.config.watchMode.enabled = false;
      this.saveConfig();
    }
  }

  /**
   * 获取插件配置
   * @param pluginName 插件名称
   */
  getPluginConfig<T = any>(pluginName: string): T {
    const plugins = this.config.plugins || {};
    return (plugins[pluginName] || {}) as T;
  }

  /**
   * 设置插件配置
   * @param pluginName 插件名称
   * @param config 插件配置
   */
  setPluginConfig(pluginName: string, config: any): void {
    if (!this.config.plugins) {
      this.config.plugins = {};
    }
    this.config.plugins[pluginName] = config;
    this.saveConfig();
  }

  /**
   * 删除插件配置
   * @param pluginName 插件名称
   */
  removePluginConfig(pluginName: string): void {
    if (this.config.plugins && this.config.plugins[pluginName]) {
      delete this.config.plugins[pluginName];
      this.saveConfig();
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 获取配置目录
   */
  getConfigDir(): string {
    return this.configDir;
  }
}
