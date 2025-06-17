import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { homedir } from 'os';

/**
 * 权限管理器
 * 用于管理项目访问权限
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private readonly authStoragePath: string;
  private authorizedPaths: Set<string>;

  /**
   * 构造函数
   */
  private constructor() {
    // 在用户主目录创建配置目录
    const configDir = path.join(homedir(), '.code-insight');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this.authStoragePath = path.join(configDir, 'authorized-paths.json');
    this.authorizedPaths = this.loadAuthorizedPaths();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * 加载已授权路径
   */
  private loadAuthorizedPaths(): Set<string> {
    try {
      if (fs.existsSync(this.authStoragePath)) {
        const data = fs.readFileSync(this.authStoragePath, 'utf8');
        const paths = JSON.parse(data) as string[];
        return new Set(paths);
      }
    } catch (error) {
      console.error('加载授权路径失败:', error);
    }
    return new Set<string>();
  }

  /**
   * 保存已授权路径
   */
  private saveAuthorizedPaths(): void {
    try {
      fs.writeFileSync(
        this.authStoragePath,
        JSON.stringify([...this.authorizedPaths]),
        'utf8'
      );
    } catch (error) {
      console.error('保存授权路径失败:', error);
    }
  }

  /**
   * 检查路径是否已授权
   */
  public isAuthorized(projectPath: string): boolean {
    const resolvedPath = path.resolve(projectPath);
    return this.authorizedPaths.has(resolvedPath);
  }

  /**
   * 请求访问权限
   */
  public async requestAccess(projectPath: string): Promise<boolean> {
    const resolvedPath = path.resolve(projectPath);

    // 已有权限
    if (this.isAuthorized(resolvedPath)) {
      return true;
    }

    // 提示用户授权
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '授权访问?',
        default: false,
      },
    ]);

    if (confirm) {
      this.authorizedPaths.add(resolvedPath);
      this.saveAuthorizedPaths();
      return true;
    }

    return false;
  }

  /**
   * 撤销路径授权
   */
  public revokeAccess(projectPath: string): boolean {
    const resolvedPath = path.resolve(projectPath);
    if (this.authorizedPaths.has(resolvedPath)) {
      this.authorizedPaths.delete(resolvedPath);
      this.saveAuthorizedPaths();
      return true;
    }
    return false;
  }

  /**
   * 获取所有已授权的路径
   */
  public getAllAuthorizedPaths(): string[] {
    return [...this.authorizedPaths];
  }
}
