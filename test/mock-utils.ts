/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest */
/**
 * 测试辅助工具模块
 * 提供常用的模拟函数和工具方法
 */

/**
 * 创建模拟FS模块
 */
export function createMockFS() {
  const files: Record<string, string | Buffer> = {};
  const dirs: Record<string, boolean> = {};

  return {
    existsSync: jest.fn().mockImplementation((path: string) => {
      return Boolean(files[path]) || Boolean(dirs[path]);
    }),
    readFileSync: jest.fn().mockImplementation((path: string) => {
      if (!files[path]) {
        throw new Error(`File not found: ${path}`);
      }
      return files[path];
    }),
    writeFileSync: jest
      .fn()
      .mockImplementation((path: string, data: string | Buffer) => {
        files[path] = data;
        return true;
      }),
    statSync: jest.fn().mockImplementation((path: string) => {
      if (dirs[path]) {
        return {
          isDirectory: () => true,
          isFile: () => false,
          mtime: new Date(),
          size: 0,
        };
      }
      if (files[path]) {
        return {
          isDirectory: () => false,
          isFile: () => true,
          mtime: new Date(),
          size:
            typeof files[path] === 'string'
              ? Buffer.from(files[path] as string).length
              : (files[path] as Buffer).length,
        };
      }
      throw new Error(`No such file or directory: ${path}`);
    }),
    readdirSync: jest.fn().mockImplementation((path: string) => {
      if (!dirs[path]) {
        throw new Error(`Directory not found: ${path}`);
      }

      const result: string[] = [];
      const prefix = path.endsWith('/') ? path : `${path}/`;

      // 查找文件
      Object.keys(files).forEach((filePath) => {
        if (filePath.startsWith(prefix)) {
          const relativePath = filePath.slice(prefix.length);
          if (!relativePath.includes('/')) {
            result.push(relativePath);
          }
        }
      });

      // 查找目录
      Object.keys(dirs).forEach((dirPath) => {
        if (dirPath !== path && dirPath.startsWith(prefix)) {
          const relativePath = dirPath.slice(prefix.length);
          const parts = relativePath.split('/');
          if (parts.length === 1) {
            result.push(parts[0]);
          }
        }
      });

      return result;
    }),
    mkdirSync: jest.fn().mockImplementation((path: string) => {
      dirs[path] = true;
      return true;
    }),
    unlinkSync: jest.fn().mockImplementation((path: string) => {
      if (!files[path]) {
        throw new Error(`File not found: ${path}`);
      }
      delete files[path];
      return true;
    }),
    rmdirSync: jest.fn().mockImplementation((path: string) => {
      if (!dirs[path]) {
        throw new Error(`Directory not found: ${path}`);
      }
      delete dirs[path];
      return true;
    }),

    // 测试辅助方法
    __setFiles: (newFiles: Record<string, string | Buffer>) => {
      Object.keys(newFiles).forEach((path) => {
        files[path] = newFiles[path];

        // 自动创建父目录
        let dir = path.split('/').slice(0, -1).join('/');
        while (dir) {
          dirs[dir] = true;
          dir = dir.split('/').slice(0, -1).join('/');
          if (!dir) break;
        }
      });
    },
    __setDirectories: (newDirs: string[]) => {
      newDirs.forEach((path) => {
        dirs[path] = true;
      });
    },
    __reset: () => {
      Object.keys(files).forEach((key) => delete files[key]);
      Object.keys(dirs).forEach((key) => delete dirs[key]);
    },
  };
}

/**
 * 创建模拟路径模块
 */
export function createMockPath() {
  return {
    join: jest.fn().mockImplementation((...parts: string[]) => parts.join('/')),
    resolve: jest
      .fn()
      .mockImplementation((...parts: string[]) => parts.join('/')),
    dirname: jest
      .fn()
      .mockImplementation((p: string) => p.split('/').slice(0, -1).join('/')),
    basename: jest.fn().mockImplementation((p: string, ext?: string) => {
      const base = p.split('/').pop() || '';
      if (!ext) return base;
      return base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    }),
    extname: jest.fn().mockImplementation((p: string) => {
      const base = p.split('/').pop() || '';
      const lastDot = base.lastIndexOf('.');
      return lastDot === -1 ? '' : base.slice(lastDot);
    }),
  };
}

/**
 * 等待指定毫秒
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建模拟控制台对象
 */
export function createMockConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  return {
    log: jest.fn().mockImplementation((...args: any[]) => {
      logs.push(args.map((a) => String(a)).join(' '));
    }),
    error: jest.fn().mockImplementation((...args: any[]) => {
      errors.push(args.map((a) => String(a)).join(' '));
    }),
    warn: jest.fn().mockImplementation((...args: any[]) => {
      warnings.push(args.map((a) => String(a)).join(' '));
    }),
    info: jest.fn().mockImplementation((...args: any[]) => {
      infos.push(args.map((a) => String(a)).join(' '));
    }),
    // 获取输出历史
    __getLogs: () => logs,
    __getErrors: () => errors,
    __getWarnings: () => warnings,
    __getInfos: () => infos,
    // 清除历史
    __reset: () => {
      logs.length = 0;
      errors.length = 0;
      warnings.length = 0;
      infos.length = 0;
    },
  };
}
