import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import os from 'os';
import crypto from 'crypto';
import { AnalysisConfig } from '../config/config-manager';

/**
 * 缓存项结构
 */
interface CacheItem<T> {
  /**
   * 缓存创建的时间戳
   */
  timestamp: number;

  /**
   * 缓存的数据
   */
  data: T;

  /**
   * 源文件的哈希值
   */
  sourceHash?: string;
}

/**
 * 缓存配置选项
 */
interface CacheOptions {
  /**
   * 缓存TTL（秒）
   */
  ttl: number;

  /**
   * 缓存目录
   */
  cacheDir: string;

  /**
   * 是否检查源文件变化
   */
  checkSourceChange?: boolean;
}

/**
 * 性能优化器
 *
 * 提供缓存和并行处理功能，以提高分析性能
 */
export class PerformanceOptimizer {
  /**
   * 配置
   */
  private readonly config: AnalysisConfig;

  /**
   * 缓存目录
   */
  private readonly cacheDir: string;

  /**
   * 最大工作线程数
   */
  private readonly maxWorkers: number;

  /**
   * 构造函数
   * @param config 分析配置
   */
  constructor(config: AnalysisConfig) {
    this.config = config;
    this.cacheDir = path.join(os.homedir(), '.code-insight', 'cache');
    this.maxWorkers =
      config.performance?.maxWorkers || Math.max(1, os.cpus().length - 1);

    // 确保缓存目录存在
    this.ensureCacheDir();
  }

  /**
   * 使用缓存运行函数
   * @param key 缓存键
   * @param fn 要运行的函数
   * @param options 缓存选项
   * @returns 函数执行结果或缓存的结果
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    options?: Partial<CacheOptions>
  ): Promise<T> {
    if (!this.config.performance?.useCache) {
      return fn();
    }

    const opts: CacheOptions = {
      ttl: this.config.performance?.cacheTTL || 86400,
      cacheDir: this.cacheDir,
      checkSourceChange: true,
      ...options,
    };

    const cacheFilePath = this.getCacheFilePath(key);

    // 尝试从缓存中读取
    try {
      if (fs.existsSync(cacheFilePath)) {
        const cacheContent = fs.readFileSync(cacheFilePath, 'utf8');
        const cache = JSON.parse(cacheContent) as CacheItem<T>;

        // 检查TTL
        const now = Date.now();
        const cacheAge = now - cache.timestamp;

        if (cacheAge < opts.ttl * 1000) {
          // 缓存未过期，返回缓存结果
          console.info(`使用缓存: ${key}`);
          return cache.data;
        }
      }
    } catch (error) {
      console.warn(`缓存读取失败: ${(error as Error).message}`);
    }

    // 执行函数
    const result = await fn();

    // 保存到缓存
    try {
      const cache: CacheItem<T> = {
        timestamp: Date.now(),
        data: result,
      };

      fs.writeFileSync(cacheFilePath, JSON.stringify(cache), 'utf8');
      console.info(`已缓存结果: ${key}`);
    } catch (error) {
      console.warn(`缓存写入失败: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * 并行运行多个任务
   * @param tasks 任务列表
   * @returns 任务执行结果
   */
  async runInParallel<T, R>(
    tasks: { id: string; data: T }[],
    workerScript: string,
    timeoutMs = 60000
  ): Promise<Record<string, R>> {
    if (!this.config.performance?.useParallel || tasks.length <= 1) {
      // 如果不使用并行或任务数量为1，则串行执行
      const result: Record<string, R> = {};
      for (const task of tasks) {
        result[task.id] = await this.runSingleTask<T, R>(
          task.data,
          workerScript
        );
      }
      return result;
    }

    // 控制并发数
    const maxConcurrent = Math.min(tasks.length, this.maxWorkers);
    const results: Record<string, R> = {};
    const workQueue = [...tasks];
    const runningWorkers: Promise<void>[] = [];

    // 处理函数
    const processTask = async (): Promise<void> => {
      if (workQueue.length === 0) return;

      const task = workQueue.shift()!;
      console.info(`开始处理任务: ${task.id}`);

      try {
        // 创建包含超时的Promise
        const resultPromise = this.runSingleTask<T, R>(task.data, workerScript);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`任务超时: ${task.id}`)),
            timeoutMs
          );
        });

        // 使用Promise.race来实现超时
        results[task.id] = await Promise.race([resultPromise, timeoutPromise]);
        console.info(`任务完成: ${task.id}`);
      } catch (error) {
        console.error(`任务失败 ${task.id}: ${(error as Error).message}`);
        results[task.id] = { error: (error as Error).message } as unknown as R;
      }

      // 继续处理下一个任务
      if (workQueue.length > 0) {
        runningWorkers.push(processTask());
      }
    };

    // 初始启动最大并发数的任务
    for (let i = 0; i < maxConcurrent; i++) {
      if (workQueue.length > 0) {
        runningWorkers.push(processTask());
      }
    }

    // 等待所有任务完成
    await Promise.all(runningWorkers);
    return results;
  }

  /**
   * 增量分析，只处理有变化的文件
   * @param files 文件列表
   * @param processFn 处理函数
   * @returns 处理结果
   */
  async incrementalProcess<T>(
    files: string[],
    processFn: (file: string) => Promise<T>
  ): Promise<Record<string, T>> {
    const results: Record<string, T> = {};

    for (const file of files) {
      const cacheKey = `incremental:${path.basename(file)}`;

      results[file] = await this.withCache(cacheKey, () => processFn(file), {
        checkSourceChange: true,
        ttl: this.config.performance?.cacheTTL || 86400,
      });
    }

    return results;
  }

  /**
   * 在工作线程中运行单个任务
   */
  private async runSingleTask<T, R>(data: T, workerScript: string): Promise<R> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerScript, {
        workerData: data,
      });

      worker.on('message', (result: R) => {
        resolve(result);
      });

      worker.on('error', (err) => {
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`工作线程退出，退出码: ${code}`));
        }
      });
    });
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(key: string): string {
    // 将键转换为合法的文件名
    const safeKey = key.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 获取文件的哈希值
   */
  private getFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }

  /**
   * 清理过期缓存
   * @param maxAgeDays 最大缓存时间（天）
   */
  public cleanCache(maxAgeDays = 30): void {
    if (!fs.existsSync(this.cacheDir)) {
      return;
    }

    const files = fs.readdirSync(this.cacheDir);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      } catch (error) {
        console.warn(`清理缓存失败: ${(error as Error).message}`);
      }
    }

    console.info(`清理了 ${cleanedCount} 个过期缓存文件`);
  }

  private async computeHash(data: string | Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 直接使用crypto创建哈希
        const dataHash = crypto.createHash('md5').update(data).digest('hex');
        resolve(dataHash);
      } catch (error) {
        reject(error);
      }
    });
  }
}
