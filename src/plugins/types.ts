/**
 * 插件接口
 * 定义插件需要实现的基本方法
 */
export interface IPlugin {
  /**
   * 插件名称
   */
  name: string;

  /**
   * 插件版本
   */
  version: string;

  /**
   * 插件描述
   */
  description: string;

  /**
   * 插件作者
   */
  author: string;

  /**
   * 初始化插件
   */
  initialize(): Promise<void>;

  /**
   * 执行插件
   *
   * @param context - 插件上下文
   * @returns 执行结果
   */
  execute(context: PluginContext): Promise<PluginResult>;

  /**
   * 清理插件资源
   */
  cleanup?(): Promise<void>;
}

/**
 * 插件上下文接口
 * 提供给插件访问的上下文信息
 */
export interface PluginContext {
  /**
   * 项目路径
   */
  projectPath: string;

  /**
   * 配置信息
   */
  config: Record<string, any>;

  /**
   * 工具集
   */
  tools: PluginTools;

  /**
   * 分析结果
   */
  analysisResults: Record<string, any>;
}

/**
 * 插件工具接口
 * 提供给插件使用的工具函数
 */
export interface PluginTools {
  /**
   * 日志工具
   */
  logger: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
  };

  /**
   * 文件系统操作
   */
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    listFiles(pattern: string | string[]): Promise<string[]>;
  };

  /**
   * 解析工具
   */
  parser: {
    parseTypeScript(code: string): any;
    parseJavaScript(code: string): any;
  };
}

/**
 * 插件结果接口
 */
export interface PluginResult {
  /**
   * 是否执行成功
   */
  success: boolean;

  /**
   * 插件名称
   */
  pluginName?: string;

  /**
   * 结果数据
   */
  data?: any;

  /**
   * 错误信息（如果有）
   */
  error?: string;

  /**
   * 结果摘要
   */
  summary?: string;

  /**
   * 问题列表
   */
  issues?: Array<{
    /**
     * 问题级别
     */
    level: 'info' | 'warning' | 'error';

    /**
     * 问题消息
     */
    message: string;

    /**
     * 相关文件
     */
    file?: string;

    /**
     * 行号
     */
    line?: number;

    /**
     * 列号
     */
    column?: number;

    /**
     * 代码片段
     */
    snippet?: string;

    /**
     * 修复建议
     */
    suggestion?: string;
  }>;

  /**
   * 性能指标
   */
  performance?: {
    /**
     * 开始时间戳
     */
    startTime: number;

    /**
     * 结束时间戳
     */
    endTime: number;

    /**
     * 处理的文件数
     */
    filesProcessed?: number;

    /**
     * 内存使用量 (MB)
     */
    memoryUsage?: number;
  };
}

/**
 * 插件元数据接口
 */
export interface PluginMetadata {
  /**
   * 插件名称
   */
  name: string;

  /**
   * 插件版本
   */
  version: string;

  /**
   * 插件描述
   */
  description: string;

  /**
   * 插件作者
   */
  author: string;

  /**
   * 插件入口模块路径
   */
  main: string;

  /**
   * 插件依赖
   */
  dependencies?: Record<string, string>;

  /**
   * 插件配置架构
   */
  configSchema?: Record<string, any>;
}

/**
 * 插件钩子名称枚举
 */
export enum PluginHookName {
  BEFORE_ANALYSIS = 'beforeAnalysis',
  AFTER_ANALYSIS = 'afterAnalysis',
  BEFORE_FILE_ANALYSIS = 'beforeFileAnalysis',
  AFTER_FILE_ANALYSIS = 'afterFileAnalysis',
  BEFORE_REPORT_GENERATION = 'beforeReportGeneration',
  AFTER_REPORT_GENERATION = 'afterReportGeneration',
  WATCH_MODE_START = 'watchModeStart',
  WATCH_MODE_FILE_CHANGED = 'watchModeFileChanged',
  WATCH_MODE_END = 'watchModeEnd',
  CONFIG_CHANGE = 'configChange',
  BEFORE_INCREMENTAL_ANALYSIS = 'beforeIncrementalAnalysis',
  AFTER_INCREMENTAL_ANALYSIS = 'afterIncrementalAnalysis',
  PLUGIN_INSTALLED = 'pluginInstalled',
  PLUGIN_UNINSTALLED = 'pluginUninstalled',
  BEFORE_DEPENDENCY_ANALYSIS = 'beforeDependencyAnalysis',
  AFTER_DEPENDENCY_ANALYSIS = 'afterDependencyAnalysis',
}

/**
 * 插件钩子接口
 */
export interface PluginHook<T = any> {
  /**
   * 钩子名称
   */
  name: PluginHookName | string;

  /**
   * 钩子优先级
   * 数值越小优先级越高，默认为10
   */
  priority?: number;

  /**
   * 钩子处理函数
   *
   * @param data - 钩子数据
   * @param context - 插件上下文
   * @returns 处理后的数据
   */
  handler(data: T, context: PluginContext): Promise<T>;
}
