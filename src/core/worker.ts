import { parentPort } from 'worker_threads';
import * as path from 'path';
import { Task, TaskResult } from './processor';

if (!parentPort) {
  throw new Error('该脚本必须作为工作线程运行');
}

// 接收任务
parentPort.on('message', async (task: Task) => {
  if (!task || !task.id || !task.handlerPath) {
    sendError(task?.id || 'unknown', '无效的任务格式');
    return;
  }

  const startTime = Date.now();

  try {
    // 加载任务处理器
    const handlerPath = path.resolve(process.cwd(), task.handlerPath);

    // 动态导入处理器模块
    const handlerModule = await import(handlerPath);

    // 获取处理函数
    const handler = handlerModule.default || handlerModule;

    if (typeof handler !== 'function') {
      sendError(task.id, `处理器不是一个函数: ${task.handlerPath}`);
      return;
    }

    // 执行处理函数
    const result = await handler(task.input);

    // 计算执行时间
    const executionTime = Date.now() - startTime;

    // 发送结果
    parentPort!.postMessage({
      taskId: task.id,
      result,
      success: true,
      executionTime,
    } as TaskResult);
  } catch (error) {
    sendError(
      task.id,
      error instanceof Error ? error.message : String(error),
      Date.now() - startTime
    );
  }
});

/**
 * 发送错误信息
 *
 * @param taskId - 任务ID
 * @param errorMessage - 错误信息
 * @param executionTime - 执行时间
 */
function sendError(
  taskId: string,
  errorMessage: string,
  executionTime: number = 0
): void {
  parentPort!.postMessage({
    taskId,
    result: null,
    success: false,
    error: errorMessage,
    executionTime,
  } as TaskResult);
}
