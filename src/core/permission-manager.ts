import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/logger';

/**
 * 权限管理器
 * 负责管理文件系统访问权限
 */
export class PermissionManager {
  private configDir: string;
  private accessLogPath: string;
  private authorizedPaths: Set<string>;
  private logger: Logger;

  constructor() {
    this.configDir = path.join(os.homedir(), '.code-insight');
    this.accessLogPath = path.join(this.configDir, 'access.log');
    this.authorizedPaths = new Set<string>();
    this.logger = new Logger();

    this.init();
  }

  /**
   * 初始化
   */
  private init(): void {
    try {
      // 确保配置目录存在
      fs.ensureDirSync(this.configDir);

      // 加载已授权路径
      if (fs.existsSync(this.accessLogPath)) {
        const content = fs.readFileSync(this.accessLogPath, 'utf-8');
        content
          .split('\n')
          .filter(Boolean)
          .forEach((line) => {
            const [path] = line.split(',');
            if (path) {
              this.authorizedPaths.add(path);
            }
          });
      }
    } catch (error) {
      this.logger.error('初始化权限管理器失败:', error);
    }
  }

  /**
   * 请求访问权限
   * 注意：这个方法本身不再实现交互逻辑，而是由专门的交互模块调用
   * @param path 文件路径
   * @returns 是否已获得授权
   */
  async requestAccess(path: string): Promise<boolean> {
    // 检查是否已有授权
    if (this.isAuthorized(path)) {
      return true;
    }

    // 实际的权限交互已经移到了PermissionPrompt类中
    // 这里只返回未授权状态，让调用者决定如何处理
    return false;
  }

  /**
   * 检查是否已授权
   * @param path 文件路径
   */
  isAuthorized(path: string): boolean {
    const resolvedPath = fs.realpathSync(path);

    // 检查是否有完全匹配的路径
    if (this.authorizedPaths.has(resolvedPath)) {
      return true;
    }

    // 检查是否是已授权路径的子目录
    for (const authorizedPath of this.authorizedPaths) {
      if (resolvedPath.startsWith(authorizedPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 记录访问
   * @param path 文件路径
   */
  recordAccess(path: string): void {
    try {
      const resolvedPath = fs.realpathSync(path);
      this.authorizedPaths.add(resolvedPath);

      const timestamp = new Date().toISOString();
      const logEntry = `${resolvedPath},${timestamp}\n`;

      fs.appendFileSync(this.accessLogPath, logEntry);
    } catch (error) {
      this.logger.error('记录权限信息失败:', error);
    }
  }

  /**
   * 清除授权记录
   */
  clearAuthorizations(): void {
    try {
      this.authorizedPaths.clear();
      fs.writeFileSync(this.accessLogPath, '');
    } catch (error) {
      this.logger.error('清除权限记录失败:', error);
    }
  }
}
