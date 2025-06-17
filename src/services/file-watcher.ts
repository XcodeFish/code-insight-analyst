import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import { EventEmitter } from 'events';

/**
 * 文件变更信息
 */
export interface FileChangeInfo {
  /**
   * 文件路径
   */
  path: string;

  /**
   * 变更类型: 'add', 'change', 'delete'
   */
  type: 'add' | 'change' | 'delete';

  /**
   * 变更时间
   */
  timestamp: number;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  /**
   * 总文件数
   */
  totalFiles: number;

  /**
   * 各扩展名的文件数
   */
  extensions: Map<string, number>;
}

/**
 * 文件监视器
 * 用于监视文件变化和分析文件统计信息
 */
export class FileWatcher extends EventEmitter {
  /**
   * 监视的路径
   */
  private watchPath: string | null = null;

  /**
   * 监视配置
   */
  private config: {
    /**
     * 包含模式
     */
    include: string[];

    /**
     * 排除模式
     */
    exclude: string[];

    /**
     * 轮询间隔（毫秒）
     */
    interval: number;
  } = {
    include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    interval: 5000,
  };

  /**
   * 上次文件修改时间
   */
  private lastModifiedTimes: Map<string, number> = new Map();

  /**
   * 文件列表缓存
   */
  private filesCache: string[] = [];

  /**
   * 监视计时器
   */
  private watchTimer: NodeJS.Timeout | null = null;

  /**
   * 是否正在运行
   */
  private isRunning = false;

  /**
   * 启动文件监视
   * @param watchPath 要监视的路径
   * @param config 监视配置
   */
  async start(
    watchPath: string,
    config?: {
      include?: string[];
      exclude?: string[];
      interval?: number;
    }
  ): Promise<void> {
    this.watchPath = path.resolve(watchPath);

    // 合并配置
    if (config) {
      this.config = {
        include: config.include || this.config.include,
        exclude: config.exclude || this.config.exclude,
        interval: config.interval || this.config.interval,
      };
    }

    // 初始化文件状态
    await this.initializeFileStatus();

    // 开始轮询
    if (!this.isRunning) {
      this.isRunning = true;
      this.startPolling();
    }
  }

  /**
   * 停止文件监视
   */
  stop(): void {
    this.isRunning = false;
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    this.watchPath = null;
    this.lastModifiedTimes.clear();
    this.filesCache = [];
  }

  /**
   * 初始化文件状态
   */
  private async initializeFileStatus(): Promise<void> {
    if (!this.watchPath) {
      throw new Error('监视路径未设置');
    }

    // 获取所有文件
    const files = await this.getFiles();
    this.filesCache = [...files];

    // 记录文件修改时间
    for (const file of files) {
      try {
        const stats = fs.statSync(file);
        this.lastModifiedTimes.set(file, stats.mtimeMs);
      } catch (error) {
        // 忽略访问错误
      }
    }
  }

  /**
   * 开始轮询检查文件变化
   */
  private startPolling(): void {
    this.watchTimer = setInterval(async () => {
      if (!this.isRunning || !this.watchPath) {
        return;
      }

      try {
        const changes = await this.checkChanges();
        if (changes.length > 0) {
          this.emit('changes', changes);
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.interval);
  }

  /**
   * 检查文件变化
   */
  private async checkChanges(): Promise<FileChangeInfo[]> {
    if (!this.watchPath) {
      return [];
    }

    const currentFiles = await this.getFiles();
    const changes: FileChangeInfo[] = [];
    const currentPaths = new Set(currentFiles);
    const now = Date.now();

    // 检查新增和修改的文件
    for (const file of currentFiles) {
      try {
        const stats = fs.statSync(file);
        const lastModified = this.lastModifiedTimes.get(file);

        if (lastModified === undefined) {
          // 新文件
          changes.push({
            path: file,
            type: 'add',
            timestamp: now,
          });
          this.lastModifiedTimes.set(file, stats.mtimeMs);
        } else if (stats.mtimeMs > lastModified) {
          // 修改的文件
          changes.push({
            path: file,
            type: 'change',
            timestamp: now,
          });
          this.lastModifiedTimes.set(file, stats.mtimeMs);
        }
      } catch (error) {
        // 忽略访问错误
      }
    }

    // 检查删除的文件
    for (const file of this.filesCache) {
      if (!currentPaths.has(file)) {
        changes.push({
          path: file,
          type: 'delete',
          timestamp: now,
        });
        this.lastModifiedTimes.delete(file);
      }
    }

    // 更新缓存
    this.filesCache = [...currentFiles];

    return changes;
  }

  /**
   * 获取项目文件列表
   */
  private async getFiles(): Promise<string[]> {
    if (!this.watchPath) {
      return [];
    }

    const files: string[] = [];

    for (const pattern of this.config.include) {
      try {
        const matches = await this.globPromise(pattern, {
          cwd: this.watchPath,
          ignore: this.config.exclude,
          absolute: true,
        });
        files.push(...matches);
      } catch (error) {
        // 忽略错误
      }
    }

    return files;
  }

  /**
   * Promise化的glob
   */
  private globPromise(
    pattern: string,
    options: glob.IOptions
  ): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      glob.glob(pattern, options, (err, matches) => {
        if (err) {
          reject(err);
        } else {
          resolve(matches);
        }
      });
    });
  }

  /**
   * 获取文件统计信息
   * @param projectPath 项目路径
   */
  async getFileStats(projectPath: string): Promise<FileStats> {
    const resolvedPath = path.resolve(projectPath);
    const stats: FileStats = {
      totalFiles: 0,
      extensions: new Map<string, number>(),
    };

    // 从当前配置获取包含和排除模式
    const include = this.config.include;
    const exclude = this.config.exclude;

    // 模拟文件统计，实际项目应该实现真实的文件计数
    const exts = [
      { ext: 'ts', count: Math.floor(Math.random() * 1000) + 500 },
      { ext: 'js', count: Math.floor(Math.random() * 500) + 100 },
      { ext: 'tsx', count: Math.floor(Math.random() * 200) + 50 },
      { ext: 'jsx', count: Math.floor(Math.random() * 100) + 10 },
      { ext: 'html', count: Math.floor(Math.random() * 50) + 30 },
      { ext: 'css', count: Math.floor(Math.random() * 30) + 20 },
      { ext: 'json', count: Math.floor(Math.random() * 100) + 50 },
      { ext: 'md', count: Math.floor(Math.random() * 50) + 20 },
    ];

    exts.forEach(({ ext, count }) => {
      stats.extensions.set(ext, count);
      stats.totalFiles += count;
    });

    return stats;
  }
}
