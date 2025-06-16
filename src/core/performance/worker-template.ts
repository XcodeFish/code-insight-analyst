import { parentPort, workerData } from 'worker_threads';

/**
 * 工作线程任务处理器接口
 * 定义了工作线程可以处理的任务方法
 */
export interface IWorkerTaskProcessor {
  /**
   * 处理传入的任务数据
   * @param taskData 任务数据
   * @returns 处理结果
   */
  processTask(taskData: unknown): Promise<unknown>;
}

/**
 * 工作线程消息类型
 */
export enum WorkerMessageType {
  RESULT = 'result',
  ERROR = 'error',
  LOG = 'log',
}

/**
 * 工作线程基础模板
 * 所有特定的工作线程处理器应该继承此类
 */
export abstract class WorkerTemplate implements IWorkerTaskProcessor {
  /**
   * 构造函数
   */
  constructor() {
    this.initialize();
  }

  /**
   * 初始化工作线程
   */
  private initialize(): void {
    // 监听来自主线程的消息
    parentPort?.on('message', async (message) => {
      try {
        // 处理任务数据
        const result = await this.processTask(message);

        // 将结果发送回主线程
        parentPort?.postMessage({
          type: WorkerMessageType.RESULT,
          data: result,
        });
      } catch (error) {
        // 发送错误回主线程
        parentPort?.postMessage({
          type: WorkerMessageType.ERROR,
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
          },
        });
      }
    });

    // 通知主线程工作线程已准备好
    parentPort?.postMessage({
      type: WorkerMessageType.LOG,
      message: '工作线程已初始化',
    });
  }

  /**
   * 处理任务的抽象方法
   * 子类必须实现此方法以提供特定的任务处理逻辑
   */
  abstract processTask(taskData: unknown): Promise<unknown>;

  /**
   * 记录日志到主线程
   */
  protected log(message: string): void {
    parentPort?.postMessage({
      type: WorkerMessageType.LOG,
      message,
    });
  }
}

/**
 * 工作线程模板
 * 用于执行并行任务，可根据需要扩展
 *
 * 使用方法:
 * - 继承此文件创建特定任务的工作线程脚本
 * - 在processData函数中实现具体的处理逻辑
 * - 使用PerformanceOptimizer.runInParallel方法运行
 */

/**
 * 处理数据的主要函数
 * @param data 传入的数据
 * @returns 处理结果
 */
async function processData<T, R>(data: T): Promise<R> {
  // 以下是示例实现，应该根据具体需求替换
  // 目前只是简单返回输入数据
  return data as unknown as R;
}

/**
 * 如果直接作为工作线程运行，执行此代码
 * 否则，可以被其他模块导入使用
 */
if (parentPort) {
  // 这里接收主线程传递的数据，并执行处理
  (async () => {
    try {
      const result = await processData(workerData);
      parentPort!.postMessage(result);
    } catch (error) {
      parentPort!.postMessage({
        error: true,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  })();
}

/**
 * 导出处理函数以便其他模块使用
 */
export { processData };
