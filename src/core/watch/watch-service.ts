import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { debounce } from 'lodash';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config-manager';
import { PluginManager } from '../../plugins/manager';
import { PluginHookName, PluginTools } from '../../plugins/types';

/**
 * 文件变更类型枚举
 */
export enum FileChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
}

/**
 * 文件变更信息接口
 */
export interface FileChangeInfo {
  /**
   * 文件路径
   */
  path: string;

  /**
   * 变更类型
   */
  type: FileChangeType;

  /**
   * 变更时间
   */
  timestamp: number;
}

/**
 * 监测服务配置接口
 */
export interface WatchConfig {
  enabled: boolean;
  interval: number;
  patterns?: string[];
  exclude?: string[];
  analyzers?: string[];
}

/**
 * 监测服务类
 * 实现文件变更的监测和通知
 */
export class WatchService extends EventEmitter {
  private logger: Logger;
  private configManager: ConfigManager;
  private pluginManager: PluginManager;
  private watcher: chokidar.FSWatcher | null = null;
  private projectPath: string = '';
  private pendingChanges: Map<string, FileChangeInfo> = new Map();
  private isRunning: boolean = false;
  private processChangesFn: (() => Promise<void>) & { cancel(): void };

  /**
   * 构造函数
   */
  constructor() {
    super();
    this.logger = new Logger();
    this.configManager = new ConfigManager();
    this.pluginManager = new PluginManager();

    // 初始化防抖函数
    this.processChangesFn = debounce(this.processChanges.bind(this), 5000);

    // 初始化时调整最大监听器数量，避免可能的内存泄漏警告
    this.setMaxListeners(50);
  }

  /**
   * 开始监测
   * @param projectPath 项目路径
   */
  public async start(projectPath: string): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('监测服务已经在运行中');
      return;
    }

    this.projectPath = path.resolve(projectPath);
    this.logger.debug(`开始监测项目: ${this.projectPath}`);

    const watchConfig = this.configManager.get<WatchConfig>('watchMode');
    if (!watchConfig) {
      throw new Error('未找到监测模式配置');
    }

    // 更新防抖间隔
    this.processChangesFn.cancel();
    this.processChangesFn = debounce(
      this.processChanges.bind(this),
      watchConfig.interval || 5000
    );

    // 通知插件监测模式开始
    await this.pluginManager.invokeHook(
      PluginHookName.WATCH_MODE_START,
      {
        projectPath: this.projectPath,
        config: watchConfig,
      },
      {
        projectPath: this.projectPath,
        config: this.configManager.getConfig(),
        tools: this.createPluginTools(),
        analysisResults: {},
      }
    );

    // 创建文件监听器
    this.watcher = chokidar.watch(
      watchConfig.patterns || ['**/*.ts', '**/*.js'],
      {
        ignored: watchConfig.exclude || [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
        ],
        persistent: true,
        ignoreInitial: true,
        cwd: this.projectPath,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      }
    );

    // 绑定事件处理
    this.watcher
      .on('add', (filePath: string) =>
        this.handleFileChange(filePath, FileChangeType.ADDED)
      )
      .on('change', (filePath: string) =>
        this.handleFileChange(filePath, FileChangeType.MODIFIED)
      )
      .on('unlink', (filePath: string) =>
        this.handleFileChange(filePath, FileChangeType.DELETED)
      )
      .on('error', (error: Error) => this.logger.error('监测错误:', error));

    this.isRunning = true;
    this.logger.info(
      `监测服务已启动，监测间隔: ${watchConfig.interval || 5000}ms`
    );
  }

  /**
   * 停止监测
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.watcher) {
      return;
    }

    // 处理未处理的变更
    if (this.pendingChanges.size > 0) {
      await this.processChanges();
    }

    // 关闭监听器
    await this.watcher.close();
    this.watcher = null;
    this.isRunning = false;

    // 通知插件监测模式结束
    await this.pluginManager.invokeHook(
      PluginHookName.WATCH_MODE_END,
      {
        projectPath: this.projectPath,
      },
      {
        projectPath: this.projectPath,
        config: this.configManager.getConfig(),
        tools: this.createPluginTools(),
        analysisResults: {},
      }
    );

    this.logger.info('监测服务已停止');
  }

  /**
   * 暂停监测
   */
  public pause(): void {
    if (this.watcher && this.isRunning) {
      this.watcher.unwatch('**/*');
      this.logger.info('监测服务已暂停');
    }
  }

  /**
   * 恢复监测
   */
  public resume(): void {
    if (this.watcher && this.isRunning) {
      const watchConfig = this.configManager.get<WatchConfig>('watchMode');
      if (watchConfig) {
        this.watcher.add(watchConfig.patterns || ['**/*.ts', '**/*.js']);
        this.logger.info('监测服务已恢复');
      }
    }
  }

  /**
   * 处理文件变更
   */
  private handleFileChange(filePath: string, type: FileChangeType): void {
    const fullPath = path.join(this.projectPath, filePath);

    // 更新变更队列
    this.pendingChanges.set(fullPath, {
      path: fullPath,
      type,
      timestamp: Date.now(),
    });

    this.logger.debug(
      `检测到文件${type === FileChangeType.ADDED ? '新增' : type === FileChangeType.MODIFIED ? '修改' : '删除'}: ${filePath}`
    );

    // 触发处理（带防抖）
    this.processChangesFn();
  }

  /**
   * 处理变更队列
   */
  private async processChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    // 发出变更事件
    this.emit('changes', changes);

    // 通知插件文件变更
    await this.pluginManager.invokeHook(
      PluginHookName.WATCH_MODE_FILE_CHANGED,
      changes,
      {
        projectPath: this.projectPath,
        config: this.configManager.getConfig(),
        tools: this.createPluginTools(),
        analysisResults: {},
      }
    );
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
          return fs.promises.readFile(filePath, 'utf8');
        },
        writeFile: async (filePath: string, content: string): Promise<void> => {
          return fs.promises.writeFile(filePath, content);
        },
        exists: async (filePath: string): Promise<boolean> => {
          return fs.promises
            .access(filePath)
            .then(() => true)
            .catch(() => false);
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
}
