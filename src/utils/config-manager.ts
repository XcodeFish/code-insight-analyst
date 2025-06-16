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
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private configPath: string;
  private config: IConfig;
  private logger: Logger;

  constructor() {
    const configDir = path.join(os.homedir(), '.code-insight');
    this.configPath = path.join(configDir, 'config.json');
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
      const configDir = path.dirname(this.configPath);
      fs.ensureDirSync(configDir);

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
    };
    this.saveConfig();
  }
}
