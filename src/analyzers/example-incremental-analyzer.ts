import { IAnalysisResult } from '../core/analysis-orchestrator';
import { AstService } from '../core/ast-service';
import { Logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

/**
 * 示例增量分析器
 * 展示如何实现增量分析功能
 */
export class ExampleIncrementalAnalyzer {
  private projectPath: string;
  private astService: AstService;
  private logger: Logger;

  /**
   * 构造函数
   *
   * @param projectPath 项目路径
   * @param astService AST服务
   */
  constructor(projectPath: string, astService: AstService) {
    this.projectPath = projectPath;
    this.astService = astService;
    this.logger = new Logger();
  }

  /**
   * 执行完整分析
   *
   * @param progressCallback 进度回调
   * @returns 分析结果
   */
  async analyze(
    progressCallback: (message: string) => void
  ): Promise<IAnalysisResult> {
    progressCallback('开始执行完整分析...');

    // 模拟分析过程
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 获取所有文件
    progressCallback('扫描项目文件...');
    const files = this.scanProjectFiles();

    // 分析每个文件
    progressCallback(`分析 ${files.length} 个文件...`);
    const results = await this.analyzeFiles(files, progressCallback);

    // 生成报告
    progressCallback('生成分析报告...');
    const summary = this.generateSummary(results);

    return {
      type: 'example-analyzer',
      data: results,
      summary: {
        title: '示例分析器报告',
        description: '这是一个示例报告，展示如何实现增量分析',
        metrics: summary,
      },
    };
  }

  /**
   * 执行增量分析
   *
   * @param files 需要增量分析的文件列表
   * @param progressCallback 进度回调
   * @returns 增量分析结果
   */
  async analyzeIncremental(
    files: string[],
    progressCallback: (message: string) => void
  ): Promise<IAnalysisResult> {
    progressCallback(`开始增量分析 ${files.length} 个文件...`);

    // 只分析传入的文件
    const results = await this.analyzeFiles(files, progressCallback);

    // 计算增量结果的摘要
    const summary = this.generateSummary(results);

    return {
      type: 'example-analyzer',
      data: results,
      summary: {
        title: '示例增量分析结果',
        description: `针对 ${files.length} 个变更文件的分析`,
        metrics: summary,
      },
    };
  }

  /**
   * 扫描项目文件
   * @returns 文件列表
   */
  private scanProjectFiles(): string[] {
    // 简单实现，实际中应该使用递归扫描或glob模式
    const files: string[] = [];

    try {
      // 扫描直接子目录下的.ts和.js文件
      const entries = fs.readdirSync(this.projectPath, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isFile() &&
          ['.ts', '.js'].includes(path.extname(entry.name))
        ) {
          files.push(path.join(this.projectPath, entry.name));
        }
      }

      // 扫描src目录
      const srcPath = path.join(this.projectPath, 'src');
      if (fs.existsSync(srcPath)) {
        const srcEntries = fs.readdirSync(srcPath, { withFileTypes: true });

        for (const entry of srcEntries) {
          if (
            entry.isFile() &&
            ['.ts', '.js'].includes(path.extname(entry.name))
          ) {
            files.push(path.join(srcPath, entry.name));
          }
        }
      }
    } catch (error) {
      this.logger.error('扫描文件失败:', error);
    }

    return files;
  }

  /**
   * 分析文件
   * @param files 文件列表
   * @param progressCallback 进度回调
   * @returns 分析结果
   */
  private async analyzeFiles(
    files: string[],
    progressCallback: (message: string) => void
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progressCallback(
        `分析文件 ${i + 1}/${files.length}: ${path.basename(file)}`
      );

      try {
        // 读取文件内容
        const content = fs.readFileSync(file, 'utf8');

        // 简单分析
        const lines = content.split('\n').length;
        const tokens = content.match(/\w+/g) || [];
        const comments =
          (content.match(/\/\/.*/g) || []).length +
          (content.match(/\/\*[\s\S]*?\*\//g) || []).length;

        results[file] = {
          path: file,
          lines,
          tokens: tokens.length,
          comments,
          complexity: this.calculateComplexity(content),
        };

        // 模拟分析过程
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        this.logger.error(`分析文件 ${file} 失败:`, error);
        results[file] = { path: file, error: `分析失败: ${error}` };
      }
    }

    return results;
  }

  /**
   * 计算代码复杂度
   * @param content 代码内容
   * @returns 复杂度得分
   */
  private calculateComplexity(content: string): number {
    // 简单的复杂度估算
    const ifCount = (content.match(/\bif\b/g) || []).length;
    const forCount = (content.match(/\bfor\b/g) || []).length;
    const whileCount = (content.match(/\bwhile\b/g) || []).length;
    const switchCount = (content.match(/\bswitch\b/g) || []).length;
    const catchCount = (content.match(/\bcatch\b/g) || []).length;

    return (
      1 +
      ifCount * 1 +
      forCount * 2 +
      whileCount * 2 +
      switchCount * 3 +
      catchCount * 1
    );
  }

  /**
   * 生成摘要
   * @param results 分析结果
   * @returns 摘要
   */
  private generateSummary(results: Record<string, any>): Record<string, any> {
    let totalLines = 0;
    let totalTokens = 0;
    let totalComments = 0;
    let totalComplexity = 0;
    let fileCount = 0;

    // 计算总和
    Object.values(results).forEach((result: any) => {
      if (!result.error) {
        totalLines += result.lines;
        totalTokens += result.tokens;
        totalComments += result.comments;
        totalComplexity += result.complexity;
        fileCount++;
      }
    });

    // 计算平均值
    const avgLines = fileCount > 0 ? totalLines / fileCount : 0;
    const avgTokens = fileCount > 0 ? totalTokens / fileCount : 0;
    const avgComments = fileCount > 0 ? totalComments / fileCount : 0;
    const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;

    return {
      totalFiles: fileCount,
      totalLines,
      totalTokens,
      totalComments,
      avgLines: Math.round(avgLines * 10) / 10,
      avgTokens: Math.round(avgTokens * 10) / 10,
      avgComments: Math.round(avgComments * 10) / 10,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
    };
  }
}
