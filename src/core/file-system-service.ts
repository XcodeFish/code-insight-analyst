import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/logger';

/**
 * 文件信息接口
 */
export interface IFileInfo {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  isDirectory: boolean;
  lastModified: Date;
}

/**
 * 文件系统服务
 * 处理文件系统访问
 */
export class FileSystemService {
  private logger: Logger;
  private fileCache: Map<string, IFileInfo>;
  private projectRoot: string;

  constructor() {
    this.logger = new Logger();
    this.fileCache = new Map();
    this.projectRoot = '';
  }

  /**
   * 扫描目录
   * @param dirPath 目录路径
   * @returns 文件信息数组
   */
  async scanDirectory(dirPath: string): Promise<IFileInfo[]> {
    this.projectRoot = path.resolve(dirPath);
    this.logger.debug(`扫描目录: ${this.projectRoot}`);

    try {
      // 确保目录存在
      const stats = await fs.stat(this.projectRoot);
      if (!stats.isDirectory()) {
        throw new Error(`${this.projectRoot} 不是一个有效的目录`);
      }

      // 清空缓存
      this.fileCache.clear();

      // 递归扫描目录
      const files = await this.scanRecursive(this.projectRoot);

      this.logger.debug(`扫描完成，共找到 ${files.length} 个文件`);
      return files;
    } catch (error) {
      this.logger.error(`扫描目录失败 ${this.projectRoot}:`, error);
      throw error;
    }
  }

  /**
   * 递归扫描目录
   */
  private async scanRecursive(
    currentPath: string,
    results: IFileInfo[] = []
  ): Promise<IFileInfo[]> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // 忽略node_modules和隐藏目录
      if (
        entry.name === 'node_modules' ||
        entry.name.startsWith('.') ||
        entry.name === 'dist' ||
        entry.name === 'build'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        // 递归扫描子目录
        const fileInfo: IFileInfo = {
          path: fullPath,
          relativePath: path.relative(this.projectRoot, fullPath),
          size: 0,
          extension: '',
          isDirectory: true,
          lastModified: new Date(),
        };

        this.fileCache.set(fullPath, fileInfo);
        results.push(fileInfo);

        await this.scanRecursive(fullPath, results);
      } else {
        // 处理文件
        try {
          const stats = await fs.stat(fullPath);
          const extension = path.extname(entry.name).toLowerCase();

          // 只关注代码文件
          if (this.isCodeFile(extension)) {
            const fileInfo: IFileInfo = {
              path: fullPath,
              relativePath: path.relative(this.projectRoot, fullPath),
              size: stats.size,
              extension,
              isDirectory: false,
              lastModified: stats.mtime,
            };

            this.fileCache.set(fullPath, fileInfo);
            results.push(fileInfo);
          }
        } catch (error) {
          this.logger.debug(`无法读取文件信息 ${fullPath}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @returns 文件内容
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      this.logger.error(`无法读取文件 ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 写入文件
   * @param filePath 文件路径
   * @param content 文件内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      this.logger.error(`无法写入文件 ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有TypeScript/JavaScript文件
   */
  getTypescriptFiles(): IFileInfo[] {
    return Array.from(this.fileCache.values()).filter(
      (file) =>
        !file.isDirectory &&
        ['.ts', '.tsx', '.js', '.jsx'].includes(file.extension)
    );
  }

  /**
   * 获取所有代码文件
   */
  getCodeFiles(): IFileInfo[] {
    return Array.from(this.fileCache.values()).filter(
      (file) => !file.isDirectory && this.isCodeFile(file.extension)
    );
  }

  /**
   * 判断是否是代码文件
   */
  private isCodeFile(extension: string): boolean {
    const codeExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.java',
      '.c',
      '.cpp',
      '.cs',
      '.go',
      '.py',
      '.rb',
      '.php',
      '.html',
      '.css',
      '.scss',
      '.less',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
    ];

    return codeExtensions.includes(extension);
  }
}
