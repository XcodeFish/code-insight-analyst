/**
 * 文件系统模块模拟
 */
export const createMockFS = () => {
  const files: Record<string, string | Buffer> = {};
  const dirs: Record<string, boolean> = {};

  return {
    existsSync: jest.fn().mockImplementation((path: string) => {
      return Boolean(files[path]) || Boolean(dirs[path]);
    }),
    readFileSync: jest
      .fn()
      .mockImplementation((path: string, options?: any) => {
        if (!files[path]) {
          throw new Error(`文件不存在: ${path}`);
        }
        return files[path];
      }),
    writeFileSync: jest
      .fn()
      .mockImplementation((path: string, data: string | Buffer) => {
        files[path] = data;
        return true;
      }),
    readJsonSync: jest.fn().mockImplementation((path: string) => {
      if (!files[path]) {
        throw new Error(`文件不存在: ${path}`);
      }
      const content = files[path];
      return JSON.parse(
        typeof content === 'string' ? content : content.toString()
      );
    }),
    writeJsonSync: jest
      .fn()
      .mockImplementation((path: string, data: any, options?: any) => {
        files[path] = JSON.stringify(data, null, 2);
        return true;
      }),
    ensureDirSync: jest.fn().mockImplementation((path: string) => {
      dirs[path] = true;
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
        throw new Error(`目录不存在: ${path}`);
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
};
