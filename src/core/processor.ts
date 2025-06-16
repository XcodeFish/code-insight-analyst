/**
 * 并行处理器
 * 用于管理和执行并行分析任务
 */
import * as os from 'os';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as events from 'events';

/**
 * 任务类型
 */
export type Task<TInput = unknown> = {
  /**
   * 任务ID
   */
  id: string;

  /**
   * 任务处理函数的路径
   * 相对于项目根目录的路径
   */
  handlerPath: string;

  /**
   * 任务输入数据
   */
  input: TInput;

  /**
   * 优先级
   * 数值越低优先级越高
   */
  priority?: number;
};

/**
 * 任务结果
 */
export type TaskResult<T = unknown> = {
  /**
   * 任务ID
   */
  taskId: string;

  /**
   * 任务结果
   */
  result: T;

  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 错误信息
   */
  error?: string;

  /**
   * 执行时间（毫秒）
   */
  executionTime: number;
};

/**
 * 并行处理器类
 * 使用worker_threads实现多进程任务处理
 */
export class ParallelProcessor {
  /**
   * 工作线程池
   */
  private workers: Worker[] = [];

  /**
   * 任务队列
   */
  private taskQueue: Task[] = [];

  /**
   * 任务结果
   */
  private results: Map<string, TaskResult> = new Map();

  /**
   * 事件发射器
   */
  private emitter: events.EventEmitter = new events.EventEmitter();

  /**
   * 正在处理中的任务数
   */
  private processingTasks: number = 0;

  /**
   * 是否正在运行
   */
  private isRunning: boolean = false;

  /**
   * 构造函数
   *
   * @param maxWorkers - 最大工作线程数
   * @param workerScript - 工作线程脚本路径
   */
  constructor(
    private maxWorkers: number = os.cpus().length,
    private workerScript: string = path.join(__dirname, 'worker.js')
  ) {
    // 设置最大监听器数量
    this.emitter.setMaxListeners(this.maxWorkers * 2);
  }

  /**
   * 初始化工作线程池
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(this.workerScript);

      worker.on('message', (result: TaskResult) => {
        // 保存结果
        this.results.set(result.taskId, result);

        // 发送任务完成事件
        this.emitter.emit(`task-completed:${result.taskId}`, result);
        this.emitter.emit('task-completed', result);

        // 减少处理中的任务数
        this.processingTasks--;

        // 继续处理队列中的任务
        this.processNextTask(worker);
      });

      worker.on('error', (err) => {
        console.error(`工作线程错误: ${err}`);

        // 重新创建工作线程
        worker.terminate().catch(console.error);
        const newWorker = new Worker(this.workerScript);
        this.workers[this.workers.indexOf(worker)] = newWorker;

        // 减少处理中的任务数
        this.processingTasks--;
      });

      this.workers.push(worker);
    }
  }

  /**
   * 添加任务
   *
   * @param task - 任务
   * @returns 任务ID
   */
  public addTask<TInput>(task: Task<TInput>): string {
    this.taskQueue.push(task);

    // 按优先级排序
    this.taskQueue.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    return task.id;
  }

  /**
   * 添加多个任务
   *
   * @param tasks - 任务列表
   * @returns 任务ID列表
   */
  public addTasks<TInput>(tasks: Task<TInput>[]): string[] {
    const taskIds = tasks.map((task) => task.id);
    this.taskQueue.push(...tasks);

    // 按优先级排序
    this.taskQueue.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    return taskIds;
  }

  /**
   * 处理下一个任务
   *
   * @param worker - 工作线程
   */
  private processNextTask(worker: Worker): void {
    if (!this.isRunning || this.taskQueue.length === 0) {
      return;
    }

    // 获取下一个任务
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // 增加处理中的任务数
    this.processingTasks++;

    // 发送任务到工作线程
    worker.postMessage(task);
  }

  /**
   * 启动处理器
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // 初始化工作线程池
    if (this.workers.length === 0) {
      this.initializeWorkers();
    }

    // 为每个工作线程分配任务
    for (const worker of this.workers) {
      if (this.taskQueue.length > 0) {
        this.processNextTask(worker);
      }
    }
  }

  /**
   * 停止处理器
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    // 终止所有工作线程
    await Promise.all(this.workers.map((worker) => worker.terminate()));

    // 清空工作线程池
    this.workers = [];
  }

  /**
   * 等待任务完成
   *
   * @param taskId - 任务ID
   * @returns 任务结果
   */
  public async waitForTask<T>(taskId: string): Promise<TaskResult<T>> {
    // 检查结果是否已经存在
    if (this.results.has(taskId)) {
      return this.results.get(taskId) as TaskResult<T>;
    }

    // 等待任务完成
    return new Promise((resolve) => {
      this.emitter.once(`task-completed:${taskId}`, (result: TaskResult<T>) => {
        resolve(result);
      });
    });
  }

  /**
   * 等待所有任务完成
   *
   * @returns 所有任务的结果
   */
  public async waitForAll<T>(): Promise<TaskResult<T>[]> {
    if (this.taskQueue.length === 0 && this.processingTasks === 0) {
      return Array.from(this.results.values()) as TaskResult<T>[];
    }

    return new Promise((resolve) => {
      // 检查是否还有任务在进行
      const checkComplete = () => {
        if (this.taskQueue.length === 0 && this.processingTasks === 0) {
          resolve(Array.from(this.results.values()) as TaskResult<T>[]);
        }
      };

      // 初始检查
      checkComplete();

      // 监听任务完成事件
      this.emitter.on('task-completed', () => {
        checkComplete();
      });
    });
  }

  /**
   * 执行任务集合
   *
   * @param tasks - 任务列表
   * @returns 任务结果列表
   */
  public async execute<TInput, TResult>(
    tasks: Task<TInput>[]
  ): Promise<TaskResult<TResult>[]> {
    // 清除之前的结果
    this.results.clear();

    // 添加任务
    this.addTasks(tasks);

    // 启动处理器
    this.start();

    // 等待所有任务完成
    const results = await this.waitForAll<TResult>();

    return results;
  }

  /**
   * 获取待处理任务数量
   *
   * @returns 待处理任务数量
   */
  public getPendingTaskCount(): number {
    return this.taskQueue.length;
  }

  /**
   * 获取处理中任务数量
   *
   * @returns 处理中任务数量
   */
  public getProcessingTaskCount(): number {
    return this.processingTasks;
  }
}
