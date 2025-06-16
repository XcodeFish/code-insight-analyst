import fs from 'fs-extra';
import path from 'path';

/**
 * 文件系统模拟助手
 * 用于在测试中模拟文件系统操作
 */
export class FSMock {
  private mockedFiles: Map<string, string | Buffer> = new Map();
  private mockedDirs: Set<string> = new Set();

  constructor() {
    // 模拟常用的文件系统操作
    jest.spyOn(fs, 'readFileSync').mockImplementation((filepath, options) => {
      const normalizedPath = this.normalizePath(filepath.toString());

      if (this.mockedFiles.has(normalizedPath)) {
        const content = this.mockedFiles.get(normalizedPath);
        return content;
      }

      throw new Error(`模拟文件不存在: ${filepath}`);
    });

    jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath, data) => {
      const normalizedPath = this.normalizePath(filepath.toString());
      this.mockedFiles.set(normalizedPath, data);
      return true;
    });

    jest.spyOn(fs, 'existsSync').mockImplementation((filepath) => {
      const normalizedPath = this.normalizePath(filepath.toString());
      return (
        this.mockedFiles.has(normalizedPath) ||
        this.mockedDirs.has(normalizedPath) ||
        this.isInMockedDir(normalizedPath)
      );
    });

    jest.spyOn(fs, 'statSync').mockImplementation((filepath) => {
      const normalizedPath = this.normalizePath(filepath.toString());

      if (
        this.mockedDirs.has(normalizedPath) ||
        this.isInMockedDir(normalizedPath)
      ) {
        return {
          isDirectory: () => true,
          isFile: () => false,
          mtime: new Date(),
          size: 0,
        } as fs.Stats;
      }

      if (this.mockedFiles.has(normalizedPath)) {
        const content = this.mockedFiles.get(normalizedPath);
        return {
          isDirectory: () => false,
          isFile: () => true,
          mtime: new Date(),
          size:
            typeof content === 'string'
              ? Buffer.from(content).length
              : content.length,
        } as fs.Stats;
      }

      throw new Error(`模拟文件或目录不存在: ${filepath}`);
    });

    jest.spyOn(fs, 'readdirSync').mockImplementation((dirPath, options) => {
      const normalizedPath = this.normalizePath(dirPath.toString());

      if (
        !this.mockedDirs.has(normalizedPath) &&
        !this.isInMockedDir(normalizedPath)
      ) {
        throw new Error(`模拟目录不存在: ${dirPath}`);
      }

      // 获取目录下的所有文件和子目录
      const dirEntries: string[] = [];
      const pathWithSlash = normalizedPath.endsWith('/')
        ? normalizedPath
        : `${normalizedPath}/`;

      // 查找直接子文件和目录
      this.mockedFiles.forEach((_, filePath) => {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);

        if (this.normalizePath(dir) === normalizedPath) {
          dirEntries.push(filename);
        }
      });

      this.mockedDirs.forEach((dir) => {
        if (dir !== normalizedPath && dir.startsWith(pathWithSlash)) {
          const relativePath = dir.slice(pathWithSlash.length);
          const parts = relativePath.split('/');
          if (parts.length === 1) {
            dirEntries.push(parts[0]);
          }
        }
      });

      return dirEntries;
    });
  }

  /**
   * 添加模拟文件
   * @param filepath 文件路径
   * @param content 文件内容
   */
  addFile(filepath: string, content: string | Buffer): void {
    const normalizedPath = this.normalizePath(filepath);
    this.mockedFiles.set(normalizedPath, content);

    // 确保文件所在的目录也被添加
    let dir = path.dirname(normalizedPath);
    while (dir && dir !== '.' && dir !== '/') {
      this.mockedDirs.add(dir);
      dir = path.dirname(dir);
    }
  }

  /**
   * 添加模拟目录
   * @param dirPath 目录路径
   */
  addDirectory(dirPath: string): void {
    const normalizedPath = this.normalizePath(dirPath);
    this.mockedDirs.add(normalizedPath);

    // 确保父目录也被添加
    let dir = path.dirname(normalizedPath);
    while (dir && dir !== '.' && dir !== '/') {
      this.mockedDirs.add(dir);
      dir = path.dirname(dir);
    }
  }

  /**
   * 删除模拟文件或目录
   * @param path 文件或目录路径
   */
  remove(filepath: string): void {
    const normalizedPath = this.normalizePath(filepath);
    this.mockedFiles.delete(normalizedPath);
    this.mockedDirs.delete(normalizedPath);
  }

  /**
   * 清理所有模拟
   */
  reset(): void {
    this.mockedFiles.clear();
    this.mockedDirs.clear();
    jest.restoreAllMocks();
  }

  /**
   * 标准化路径
   * @param filepath 文件路径
   */
  private normalizePath(filepath: string): string {
    return path.normalize(filepath).replace(/\\/g, '/');
  }

  /**
   * 检查路径是否在已模拟的目录内
   * @param filepath 检查的路径
   */
  private isInMockedDir(filepath: string): boolean {
    const normalizedPath = this.normalizePath(filepath);

    for (const dir of this.mockedDirs) {
      if (normalizedPath.startsWith(`${dir}/`)) {
        return true;
      }
    }

    return false;
  }
}
