import { Project } from 'ts-morph';
import { InfiniteLoopDetector } from './detector';
import { PotentialInfiniteLoop, LoopRiskLevel } from './types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 死循环分析器类
 * 负责分析项目中的潜在无限循环问题
 */
export class InfiniteLoopAnalyzer {
  private detector: InfiniteLoopDetector;

  /**
   * 构造函数
   */
  constructor() {
    this.detector = new InfiniteLoopDetector();
  }

  /**
   * 分析指定路径下的文件
   *
   * @param projectPath - 项目路径
   * @param options - 分析选项
   * @returns 死循环分析结果
   */
  public async analyze(
    projectPath: string,
    options: InfiniteLoopAnalysisOptions = {}
  ): Promise<InfiniteLoopAnalysisResult> {
    console.info(`开始分析项目潜在无限循环: ${projectPath}`);

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
    const allIssues: PotentialInfiniteLoop[] = [];
    let filesAnalyzed = 0;

    for (const sourceFile of sourceFiles) {
      try {
        const fileIssues = this.detector.analyzeFile(sourceFile);
        allIssues.push(...fileIssues);
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

    // 对问题按风险等级排序
    const sortedIssues = this.sortIssuesByRisk(allIssues);

    console.info(
      `无限循环分析完成。分析了 ${filesAnalyzed} 个文件，发现 ${sortedIssues.length} 个潜在问题。`
    );

    return {
      totalFiles: filesAnalyzed,
      totalIssues: sortedIssues.length,
      issues: sortedIssues,
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
   * 按风险等级对问题进行排序
   *
   * @param issues - 问题列表
   * @returns 排序后的问题列表
   */
  private sortIssuesByRisk(
    issues: PotentialInfiniteLoop[]
  ): PotentialInfiniteLoop[] {
    const riskOrder = {
      [LoopRiskLevel.CRITICAL]: 0,
      [LoopRiskLevel.HIGH]: 1,
      [LoopRiskLevel.MEDIUM]: 2,
      [LoopRiskLevel.LOW]: 3,
    };

    return [...issues].sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
  }
}

/**
 * 死循环分析选项接口
 */
export interface InfiniteLoopAnalysisOptions {
  filePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
}

/**
 * 死循环分析结果接口
 */
export interface InfiniteLoopAnalysisResult {
  totalFiles: number;
  totalIssues: number;
  issues: PotentialInfiniteLoop[];
}

export {
  PotentialInfiniteLoop,
  LoopRiskLevel,
  LoopType,
  LoopIssueType,
} from './types';
