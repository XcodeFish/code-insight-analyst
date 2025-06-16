import { Project } from 'ts-morph';
import { MemoryLeakDetector } from './detector';
import {
  ResourceType,
  ResourceUsage,
  LeakWarning,
  ClosureLeakInfo,
  LeakSeverity,
} from './types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 内存泄漏分析器类
 * 负责分析项目中的内存泄漏问题
 */
export class MemoryLeakAnalyzer {
  private detector: MemoryLeakDetector;

  /**
   * 构造函数
   */
  constructor() {
    this.detector = new MemoryLeakDetector();
  }

  /**
   * 分析指定路径下的文件
   *
   * @param projectPath - 项目路径
   * @param options - 分析选项
   * @returns 内存泄漏警告列表
   */
  public async analyze(
    projectPath: string,
    options: MemoryLeakAnalysisOptions = {}
  ): Promise<MemoryLeakAnalysisResult> {
    console.info(`开始分析项目内存泄漏: ${projectPath}`);

    const project = new Project({
      tsConfigFilePath: this.findTsConfig(projectPath),
      skipAddingFilesFromTsConfig: true,
    });

    // 添加所有TypeScript/JavaScript文件
    const filePatterns = options.filePatterns || [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
    ];
    const excludePatterns = options.excludePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
    ];

    project.addSourceFilesAtPaths(
      filePatterns.map((pattern) => path.join(projectPath, pattern))
    );

    // 过滤排除的文件
    const sourceFiles = project.getSourceFiles().filter((file) => {
      const relativePath = path.relative(projectPath, file.getFilePath());
      return !excludePatterns.some((pattern) =>
        this.isPathMatching(relativePath, pattern)
      );
    });

    // 分析每个文件
    const allWarnings: LeakWarning[] = [];
    let filesAnalyzed = 0;

    for (const sourceFile of sourceFiles) {
      try {
        const fileWarnings = this.detector.analyzeFile(sourceFile);
        allWarnings.push(...fileWarnings);
        filesAnalyzed++;

        // 打印进度
        if (filesAnalyzed % 10 === 0) {
          console.info(
            `已分析 ${filesAnalyzed}/${sourceFiles.length} 个文件...`
          );
        }
      } catch (error) {
        console.error(`分析文件错误 ${sourceFile.getFilePath()}: ${error}`);
      }
    }

    // 对警告按严重程度排序
    const sortedWarnings = this.sortWarningsBySeverity(allWarnings);

    console.info(
      `内存泄漏分析完成。分析了 ${filesAnalyzed} 个文件，发现 ${sortedWarnings.length} 个潜在问题。`
    );

    return {
      totalFiles: filesAnalyzed,
      totalWarnings: sortedWarnings.length,
      warnings: sortedWarnings,
    };
  }

  /**
   * 查找项目中的tsconfig.json文件
   *
   * @param projectPath - 项目路径
   * @returns tsconfig文件路径
   */
  private findTsConfig(projectPath: string): string | undefined {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    return fs.existsSync(tsConfigPath) ? tsConfigPath : undefined;
  }

  /**
   * 检查路径是否匹配glob模式
   *
   * @param filePath - 文件路径
   * @param pattern - glob模式
   * @returns 是否匹配
   */
  private isPathMatching(filePath: string, pattern: string): boolean {
    // 简单的glob实现，实际项目中可以使用minimatch或glob库
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '__GLOBSTAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/__GLOBSTAR__/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * 按严重程度对警告进行排序
   *
   * @param warnings - 警告列表
   * @returns 排序后的警告列表
   */
  private sortWarningsBySeverity(warnings: LeakWarning[]): LeakWarning[] {
    const severityOrder = {
      [LeakSeverity.HIGH]: 0,
      [LeakSeverity.MEDIUM]: 1,
      [LeakSeverity.LOW]: 2,
    };

    return [...warnings].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }
}

/**
 * 内存泄漏分析选项接口
 */
export interface MemoryLeakAnalysisOptions {
  filePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
}

/**
 * 内存泄漏分析结果接口
 */
export interface MemoryLeakAnalysisResult {
  totalFiles: number;
  totalWarnings: number;
  warnings: LeakWarning[];
}

export {
  MemoryLeakDetector,
  ResourceType,
  ResourceUsage,
  LeakWarning,
  ClosureLeakInfo,
  LeakSeverity,
};
