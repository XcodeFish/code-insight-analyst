/**
 * 权限请求交互模块
 * 实现三步授权流程
 */
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import * as globModule from 'glob';
import { PermissionManager } from '../../core/permission-manager';
import { ConfigManager } from '../../utils/config-manager';

/**
 * 文件类型信息接口
 */
interface FileTypeInfo {
  extension: string;
  count: number;
}

/**
 * 权限请求交互类
 */
export class PermissionPrompt {
  private permissionManager: PermissionManager;
  private configManager: ConfigManager;

  /**
   * 构造函数
   */
  constructor() {
    this.permissionManager = new PermissionManager();
    this.configManager = new ConfigManager();
  }

  /**
   * 执行三步授权流程
   * @param projectPath 项目路径
   * @returns 是否获得授权
   */
  async requestPermission(projectPath: string): Promise<boolean> {
    try {
      // 检查是否已有授权
      if (this.permissionManager.isAuthorized(projectPath)) {
        console.log(chalk.green(`✓ 已有访问授权: ${projectPath}`));
        return true;
      }

      // 步骤1: 显示将要访问的目录
      console.log(chalk.blue(`需要访问以下目录: ${projectPath}`));
      if (!fs.existsSync(projectPath)) {
        console.log(chalk.red(`错误: 目录不存在`));
        return false;
      }

      // 收集文件类型信息
      const fileTypesInfo = this.collectFileTypeInfo(projectPath);
      const totalFiles = fileTypesInfo.reduce(
        (sum, info) => sum + info.count,
        0
      );

      // 步骤2: 列出分析涉及的文件类型
      console.log(chalk.blue('将分析以下类型的文件:'));
      fileTypesInfo.forEach((info) => {
        console.log(
          chalk.blue(`  ${info.extension.toUpperCase()} 文件: ${info.count} 个`)
        );
      });
      console.log(chalk.blue(`共计 ${totalFiles} 个文件`));

      // 步骤3: 明确需要读取的内容
      console.log(chalk.yellow('分析将包括以下内容:'));
      console.log(chalk.yellow('  - 文件内容 (用于代码分析)'));
      console.log(chalk.yellow('  - 项目结构 (用于依赖分析)'));
      console.log(
        chalk.yellow('  - 开发配置 (package.json, tsconfig.json 等)')
      );

      // 向用户请求授权
      const { permission } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'permission',
          message: '授权访问?',
          default: false,
        },
      ]);

      if (permission) {
        // 询问是否记住授权
        const { rememberPermission } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'rememberPermission',
            message: '记住此授权?',
            default: true,
          },
        ]);

        // 记录授权
        this.permissionManager.recordAccess(projectPath);

        // 如果用户选择记住授权，也将其保存到配置中
        if (rememberPermission) {
          const permissions =
            this.configManager.get<Record<string, boolean>>('permissions') ||
            {};
          permissions[projectPath] = true;
          this.configManager.set('permissions', permissions);
        }

        console.log(chalk.green(`✓ 已获得授权`));
        return true;
      } else {
        console.log(chalk.red(`✗ 授权被拒绝`));
        return false;
      }
    } catch (error) {
      console.error(chalk.red(`请求授权时出错: ${error}`));
      return false;
    }
  }

  /**
   * 收集项目中的文件类型信息
   * @param projectPath 项目路径
   * @returns 文件类型信息数组
   */
  private collectFileTypeInfo(projectPath: string): FileTypeInfo[] {
    // 常见代码文件扩展名
    const extensions = [
      'ts',
      'js',
      'tsx',
      'jsx',
      'json',
      'css',
      'scss',
      'less',
      'html',
      'vue',
      'md',
    ];

    const fileTypesInfo: FileTypeInfo[] = [];

    // 统计每种文件类型的数量
    for (const ext of extensions) {
      const pattern = `**/*.${ext}`;
      const files = globModule.sync(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true,
      });

      if (files.length > 0) {
        fileTypesInfo.push({
          extension: ext,
          count: files.length,
        });
      }
    }

    // 按文件数量降序排序
    return fileTypesInfo.sort((a, b) => b.count - a.count);
  }
}
