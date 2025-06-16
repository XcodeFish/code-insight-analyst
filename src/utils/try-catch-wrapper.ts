import { ErrorHandler, ErrorLevel } from './error-handler';

/**
 * 包装异步函数，提供统一的错误处理
 * @param fn 要执行的异步函数
 * @param errorMessage 出错时显示的错误消息
 * @param level 错误级别
 * @returns 包装后的函数
 */
export function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage: string = '操作执行失败',
  level: ErrorLevel = ErrorLevel.ERROR
): Promise<T | undefined> {
  return fn().catch(async (error: Error) => {
    const errorHandler = ErrorHandler.getInstance();

    // 构建错误上下文
    const context = {
      originalError: error.message,
      timestamp: new Date().toISOString(),
    };

    // 处理错误
    await errorHandler.handle(
      `${errorMessage}: ${error.message}`,
      level,
      context
    );

    // 根据错误级别决定是否返回
    if (level === ErrorLevel.FATAL) {
      // 致命错误已经在errorHandler中处理（进程退出）
      return undefined;
    }

    return undefined;
  });
}

/**
 * 包装同步函数，提供统一的错误处理
 * @param fn 要执行的同步函数
 * @param errorMessage 出错时显示的错误消息
 * @param level 错误级别
 * @returns 包装后的函数结果
 */
export function tryCatchSync<T>(
  fn: () => T,
  errorMessage: string = '操作执行失败',
  level: ErrorLevel = ErrorLevel.ERROR
): T | undefined {
  try {
    return fn();
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance();

    // 构建错误上下文
    const context = {
      originalError: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    // 处理错误（同步版本）
    console.error(`${errorMessage}: ${context.originalError}`);

    // 异步记录日志（不等待完成）
    errorHandler
      .handle(error instanceof Error ? error : String(error), level, context)
      .catch(() => {}); // 忽略日志记录错误

    // 根据错误级别决定是否返回
    if (level === ErrorLevel.FATAL) {
      process.exit(1);
    }

    return undefined;
  }
}
