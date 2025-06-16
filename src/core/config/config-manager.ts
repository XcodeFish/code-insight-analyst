import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 配置错误类
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(`[${code}] ${message}`);
    this.name = 'ConfigError';
  }
}

/**
 * 基础配置接口
 */
export interface BaseConfig {
  /**
   * 项目名称
   */
  projectName?: string;

  /**
   * 分析器配置
   */
  analyzers?: Record<string, boolean>;

  /**
   * 输出格式
   */
  outputFormat?: 'console' | 'html' | 'json' | 'markdown';

  /**
   * 输出路径
   */
  outputPath?: string;
}

/**
 * 分析配置接口
 */
export interface AnalysisConfig extends BaseConfig {
  /**
   * 要包含的文件类型
   */
  includeExtensions?: string[];

  /**
   * 要排除的文件或目录模式
   */
  exclude?: string[];

  /**
   * 分析配置文件
   */
  profiles?: Record<string, string[]>;

  /**
   * 自定义规则
   */
  customRules?: Record<string, any>;

  /**
   * 依赖分析配置
   */
  dependency?: {
    /**
     * 是否包含npm依赖
     */
    includeNpm?: boolean;

    /**
     * 是否分析ts类型导入
     */
    includeTypeImports?: boolean;

    /**
     * 是否生成依赖图可视化
     */
    generateGraph?: boolean;
  };

  /**
   * 性能配置
   */
  performance?: {
    /**
     * 是否使用缓存
     */
    useCache?: boolean;

    /**
     * 缓存TTL (秒)
     */
    cacheTTL?: number;

    /**
     * 是否使用并行处理
     */
    useParallel?: boolean;

    /**
     * 并行处理的最大工作线程数
     */
    maxWorkers?: number;
  };
}

/**
 * 配置管理器
 */
export class ConfigManager {
  /**
   * 默认配置
   */
  private static readonly DEFAULT_CONFIG: AnalysisConfig = {
    projectName: '',
    includeExtensions: ['ts', 'tsx', 'js', 'jsx'],
    exclude: ['node_modules', 'dist', 'build', '.git'],
    analyzers: {
      dependency: true,
      coverage: false,
      'method-dup': false,
      'unused-code': false,
      'memory-leak': false,
      'infinite-loop': false,
    },
    outputFormat: 'console',
    outputPath: './code-insight-report',
    performance: {
      useCache: true,
      cacheTTL: 86400, // 1天
      useParallel: true,
      maxWorkers: Math.max(1, os.cpus().length - 1), // 使用CPU核心数-1个工作线程
    },
    dependency: {
      includeNpm: false,
      includeTypeImports: true,
      generateGraph: false,
    },
  };

  /**
   * 全局配置文件的路径
   */
  private readonly globalConfigPath: string;

  /**
   * 项目配置文件的可能名称
   */
  private readonly projectConfigNames = [
    '.insightrc',
    '.insightrc.json',
    '.insightrc.js',
    'insight.config.js',
    'code-insight.config.js',
  ];

  /**
   * 当前配置
   */
  private config: AnalysisConfig;

  /**
   * 构造函数
   */
  constructor() {
    this.globalConfigPath = path.join(
      os.homedir(),
      '.code-insight-config.json'
    );
    this.config = { ...ConfigManager.DEFAULT_CONFIG };

    // 初始化时加载全局配置
    try {
      this.loadGlobalConfig();
    } catch (error) {
      // 全局配置加载失败时使用默认配置
      console.warn(`警告: 无法加载全局配置: ${(error as Error).message}`);
    }
  }

  /**
   * 加载项目配置
   * @param projectPath 项目路径
   * @returns 配置对象
   */
  public loadProjectConfig(projectPath: string): AnalysisConfig {
    const configPath = this.findProjectConfig(projectPath);

    if (configPath) {
      try {
        const fileConfig = this.readConfigFile(configPath);
        // 合并默认配置、全局配置和项目配置
        this.config = this.mergeConfigs(this.config, fileConfig);
        console.info(`已加载项目配置: ${configPath}`);
      } catch (error) {
        throw new ConfigError(
          `无法加载项目配置 ${configPath}: ${(error as Error).message}`,
          'ERR_CONFIG_LOAD'
        );
      }
    } else {
      console.info('未找到项目配置文件，使用默认配置');
    }

    return this.config;
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * 更新当前配置
   * @param newConfig 新的配置值
   */
  public updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = this.mergeConfigs(this.config, newConfig);
  }

  /**
   * 保存全局配置
   */
  public saveGlobalConfig(): void {
    try {
      fs.writeFileSync(
        this.globalConfigPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      console.info(`全局配置已保存至: ${this.globalConfigPath}`);
    } catch (error) {
      throw new ConfigError(
        `无法保存全局配置: ${(error as Error).message}`,
        'ERR_CONFIG_SAVE'
      );
    }
  }

  /**
   * 创建项目配置文件
   * @param projectPath 项目路径
   * @param config 配置对象
   */
  public createProjectConfig(
    projectPath: string,
    config: Partial<AnalysisConfig>
  ): string {
    const configPath = path.join(projectPath, '.insightrc.json');

    try {
      // 合并默认配置和提供的配置
      const mergedConfig = this.mergeConfigs(
        ConfigManager.DEFAULT_CONFIG,
        config
      );

      fs.writeFileSync(
        configPath,
        JSON.stringify(mergedConfig, null, 2),
        'utf8'
      );

      console.info(`项目配置已创建: ${configPath}`);
      return configPath;
    } catch (error) {
      throw new ConfigError(
        `无法创建项目配置: ${(error as Error).message}`,
        'ERR_CONFIG_CREATE'
      );
    }
  }

  /**
   * 加载全局配置
   */
  private loadGlobalConfig(): void {
    if (fs.existsSync(this.globalConfigPath)) {
      const globalConfig = this.readConfigFile(this.globalConfigPath);
      this.config = this.mergeConfigs(this.config, globalConfig);
      console.info(`已加载全局配置: ${this.globalConfigPath}`);
    } else {
      console.info('全局配置文件不存在，使用默认配置');
    }
  }

  /**
   * 查找项目配置文件
   * @param projectPath 项目路径
   * @returns 找到的配置文件路径，未找到则返回null
   */
  private findProjectConfig(projectPath: string): string | null {
    for (const configName of this.projectConfigNames) {
      const configPath = path.join(projectPath, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    return null;
  }

  /**
   * 读取配置文件
   * @param filePath 配置文件路径
   * @returns 配置对象
   */
  private readConfigFile(filePath: string): AnalysisConfig {
    const ext = path.extname(filePath);

    try {
      if (ext === '.js') {
        // 动态导入JS配置文件
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(filePath);
      } else {
        // 读取JSON配置文件
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      throw new ConfigError(
        `解析配置文件失败: ${(error as Error).message}`,
        'ERR_CONFIG_PARSE'
      );
    }
  }

  /**
   * 合并配置对象
   * @param base 基础配置
   * @param override 要覆盖的配置
   * @returns 合并后的配置
   */
  private mergeConfigs<T extends Record<string, any>>(
    base: T,
    override: Partial<T>
  ): T {
    const result = { ...base } as T;

    // 遍历覆盖项
    for (const [key, value] of Object.entries(override)) {
      // 如果两个值都是对象且不是null，则递归合并
      if (
        typeof base[key] === 'object' &&
        typeof value === 'object' &&
        base[key] !== null &&
        value !== null &&
        !Array.isArray(base[key]) &&
        !Array.isArray(value)
      ) {
        (result as any)[key] = this.mergeConfigs(
          base[key] as Record<string, any>,
          value as Record<string, any>
        );
      } else {
        // 否则直接覆盖
        (result as any)[key] = value;
      }
    }

    return result;
  }
}
