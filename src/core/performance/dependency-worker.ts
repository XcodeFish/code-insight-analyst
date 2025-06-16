import { parentPort, workerData } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import type { DependencyNode } from '../../types/dependency-types';

/**
 * 依赖分析工作线程的输入数据
 */
interface DependencyWorkerInput {
  /**
   * 要分析的文件路径
   */
  filePath: string;

  /**
   * 项目根路径
   */
  basePath: string;

  /**
   * 额外的选项
   */
  options?: {
    /**
     * 是否包含NPM依赖
     */
    includeNpm?: boolean;

    /**
     * 是否分析类型导入
     */
    includeTypeImports?: boolean;
  };
}

/**
 * 依赖分析工作线程的输出结果
 */
interface DependencyWorkerOutput {
  /**
   * 文件节点信息
   */
  node: DependencyNode;

  /**
   * 依赖列表
   */
  dependencies: string[];

  /**
   * 错误信息
   */
  error?: string;
}

/**
 * 分析单个文件的依赖关系
 *
 * 注：如果是在实际项目中，应考虑使用更强大的工具如ts-morph或babel来解析导入
 * 这里为简化示例，只使用基本的正则表达式匹配
 */
async function analyzeFileDependencies(
  input: DependencyWorkerInput
): Promise<DependencyWorkerOutput> {
  const { filePath, basePath, options = {} } = input;
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(basePath, filePath);

  try {
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return {
        node: {
          id: filePath,
          path: fullPath,
          size: 0,
        },
        dependencies: [],
        error: `文件不存在: ${fullPath}`,
      };
    }

    // 读取文件内容
    const content = fs.readFileSync(fullPath, 'utf8');
    const fileStats = fs.statSync(fullPath);

    // 使用正则表达式匹配导入语句
    // 注意: 这是一个简化的示例，实际项目中应使用AST解析器
    const dependencies: string[] = [];

    // 匹配 ES6 import 语句
    const es6ImportRegex =
      /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (shouldIncludeDependency(importPath, options)) {
        const normalizedPath = normalizePath(importPath, filePath, basePath);
        if (normalizedPath) {
          dependencies.push(normalizedPath);
        }
      }
    }

    // 匹配 CommonJS require 语句
    const commonJsRequireRegex =
      /(?:const|let|var)\s+(?:[\w{},\s]*)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = commonJsRequireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (shouldIncludeDependency(importPath, options)) {
        const normalizedPath = normalizePath(importPath, filePath, basePath);
        if (normalizedPath) {
          dependencies.push(normalizedPath);
        }
      }
    }

    // 创建节点信息
    const node: DependencyNode = {
      id: filePath,
      path: fullPath,
      size: fileStats.size,
    };

    return {
      node,
      dependencies: [...new Set(dependencies)], // 去重
    };
  } catch (error) {
    return {
      node: {
        id: filePath,
        path: fullPath,
        size: 0,
      },
      dependencies: [],
      error: (error as Error).message,
    };
  }
}

/**
 * 判断是否应该包含某个依赖
 */
function shouldIncludeDependency(
  importPath: string,
  options: DependencyWorkerInput['options'] = {}
): boolean {
  // 默认不包含node_modules中的依赖
  if (
    !options.includeNpm &&
    (importPath.startsWith('node:') || !importPath.startsWith('.'))
  ) {
    return false;
  }

  return true;
}

/**
 * 将导入路径标准化为项目相对路径
 */
function normalizePath(
  importPath: string,
  currentFile: string,
  basePath: string
): string | null {
  // 如果是内置模块或npm包，原样返回
  if (importPath.startsWith('node:') || !importPath.startsWith('.')) {
    return importPath;
  }

  try {
    // 计算相对路径
    const currentDir = path.dirname(currentFile);
    let absolutePath = path.resolve(
      path.join(basePath, currentDir),
      importPath
    );

    // 处理没有扩展名的情况
    if (!path.extname(absolutePath)) {
      // 尝试常见的扩展名
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
      for (const ext of extensions) {
        if (fs.existsSync(absolutePath + ext)) {
          absolutePath += ext;
          break;
        }
      }

      // 检查是否为目录，可能是index文件
      if (
        fs.existsSync(absolutePath) &&
        fs.statSync(absolutePath).isDirectory()
      ) {
        for (const ext of extensions) {
          const indexPath = path.join(absolutePath, `index${ext}`);
          if (fs.existsSync(indexPath)) {
            absolutePath = indexPath;
            break;
          }
        }
      }
    }

    // 转换为项目相对路径
    const relativePath = path.relative(basePath, absolutePath);
    return relativePath.replace(/\\/g, '/'); // 统一使用正斜杠
  } catch (error) {
    // 如果路径解析失败，返回null
    return null;
  }
}

// 如果作为工作线程执行
if (parentPort) {
  (async () => {
    try {
      const result = await analyzeFileDependencies(
        workerData as DependencyWorkerInput
      );
      parentPort!.postMessage(result);
    } catch (error) {
      parentPort!.postMessage({
        node: {
          id: (workerData as DependencyWorkerInput).filePath,
          path: path.join(
            (workerData as DependencyWorkerInput).basePath,
            (workerData as DependencyWorkerInput).filePath
          ),
          size: 0,
        },
        dependencies: [],
        error: (error as Error).message,
      });
    }
  })();
}

// 导出分析函数
export { analyzeFileDependencies };
