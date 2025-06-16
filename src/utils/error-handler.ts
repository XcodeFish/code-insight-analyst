import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

// 将fs方法转换为Promise
const mkdir = promisify(fs.mkdir);
const appendFile = promisify(fs.appendFile);

/**
 * 错误级别枚举
 */
export enum ErrorLevel {
  /**
   * 信息级别，不影响程序执行
   */
  INFO = 'info',

  /**
   * 警告级别，可能影响部分功能但不致命
   */
  WARNING = 'warning',

  /**
   * 错误级别，影响分析结果准确性
   */
  ERROR = 'error',

  /**
   * 致命错误，导致程序无法继续执行
   */
  FATAL = 'fatal',
}

/**
 * 错误处理选项
 */
export interface IErrorHandlerOptions {
  /**
   * 是否在控制台显示错误
   */
  logToConsole?: boolean;

  /**
   * 是否记录错误到文件
   */
  logToFile?: boolean;

  /**
   * 错误日志文件路径
   */
  logFilePath?: string;

  /**
   * 是否包含详细堆栈信息
   */
  includeStack?: boolean;

  /**
   * 最低显示的错误级别
   */
  minLevel?: ErrorLevel;
}

/**
 * 错误处理工具类
 * 提供一致的错误处理机制
 */
export class ErrorHandler {
  private options: IErrorHandlerOptions;
  private static instance: ErrorHandler;

  /**
   * 创建错误处理器实例
   * @param options 错误处理选项
   */
  private constructor(options: IErrorHandlerOptions = {}) {
    this.options = {
      logToConsole: true,
      logToFile: true,
      logFilePath: path.join(
        os.homedir(),
        '.code-insight',
        'logs',
        'error.log'
      ),
      includeStack: true,
      minLevel: ErrorLevel.WARNING,
      ...options,
    };

    // 确保日志目录存在
    this.ensureLogDirectory();
  }

  /**
   * 获取单例实例
   * @param options 错误处理选项
   * @returns 错误处理器实例
   */
  public static getInstance(options?: IErrorHandlerOptions): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    if (this.options.logToFile) {
      const logDir = path.dirname(this.options.logFilePath || '');
      try {
        await mkdir(logDir, { recursive: true });
      } catch (err) {
        console.error(`无法创建日志目录: ${logDir}`, err);
      }
    }
  }

  /**
   * 处理错误
   * @param error 错误对象
   * @param level 错误级别
   * @param context 错误上下文信息
   */
  public async handle(
    error: Error | string,
    level: ErrorLevel = ErrorLevel.ERROR,
    context?: Record<string, any>
  ): Promise<void> {
    // 如果错误级别低于最低显示级别，忽略
    const errorLevelValues: Record<ErrorLevel, number> = {
      [ErrorLevel.INFO]: 0,
      [ErrorLevel.WARNING]: 1,
      [ErrorLevel.ERROR]: 2,
      [ErrorLevel.FATAL]: 3,
    };

    if (
      errorLevelValues[level] <
      errorLevelValues[this.options.minLevel || ErrorLevel.WARNING]
    ) {
      return;
    }

    // 构建错误信息
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const timestamp = new Date().toISOString();
    const errorMessage = errorObj.message;
    const stack = this.options.includeStack ? errorObj.stack : undefined;

    const errorInfo = {
      timestamp,
      level,
      message: errorMessage,
      stack,
      context,
    };

    // 控制台输出
    if (this.options.logToConsole) {
      this.logToConsole(errorInfo);
    }

    // 文件记录
    if (this.options.logToFile) {
      await this.logToFile(errorInfo);
    }

    // 对于致命错误，可能需要终止程序
    if (level === ErrorLevel.FATAL) {
      console.error('遇到致命错误，程序将退出');
      process.exit(1);
    }
  }

  /**
   * 控制台输出错误信息
   * @param errorInfo 错误信息对象
   */
  private logToConsole(errorInfo: any): void {
    const { level, message, stack, context } = errorInfo;

    // 根据级别选择不同的控制台方法
    let logMethod: (message?: any, ...optionalParams: any[]) => void;
    switch (level) {
      case ErrorLevel.INFO:
        logMethod = console.info;
        break;
      case ErrorLevel.WARNING:
        logMethod = console.warn;
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.FATAL:
        logMethod = console.error;
        break;
      default:
        logMethod = console.log;
    }

    // 输出错误信息
    logMethod(`[${level.toUpperCase()}] ${message}`);

    // 如果有上下文，输出上下文信息
    if (context && Object.keys(context).length > 0) {
      logMethod('上下文:', context);
    }

    // 如果包含堆栈信息，输出堆栈
    if (stack && level !== ErrorLevel.INFO) {
      logMethod('堆栈:', stack);
    }
  }

  /**
   * 将错误信息写入日志文件
   * @param errorInfo 错误信息对象
   */
  private async logToFile(errorInfo: any): Promise<void> {
    try {
      const { timestamp, level, message, stack, context } = errorInfo;

      // 构建日志条目
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

      // 添加上下文信息
      if (context && Object.keys(context).length > 0) {
        logEntry += `上下文: ${JSON.stringify(context)}\n`;
      }

      // 添加堆栈信息
      if (stack) {
        logEntry += `堆栈: ${stack}\n`;
      }

      logEntry += '----------------------\n';

      // 追加到日志文件
      await appendFile(this.options.logFilePath || '', logEntry);
    } catch (err) {
      // 写入日志文件失败，只能输出到控制台
      console.error('无法写入错误日志文件:', err);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param context 上下文信息
   */
  public async info(
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.handle(message, ErrorLevel.INFO, context);
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param context 上下文信息
   */
  public async warning(
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.handle(message, ErrorLevel.WARNING, context);
  }

  /**
   * 记录错误级别日志
   * @param error 错误对象或消息
   * @param context 上下文信息
   */
  public async error(
    error: Error | string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.handle(error, ErrorLevel.ERROR, context);
  }

  /**
   * 记录致命级别日志
   * @param error 错误对象或消息
   * @param context 上下文信息
   */
  public async fatal(
    error: Error | string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.handle(error, ErrorLevel.FATAL, context);
  }
}
