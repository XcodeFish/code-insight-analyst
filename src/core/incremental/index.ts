import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { promises as fsPromises } from 'fs';

import { IIncrementalInfo } from '../../types/analysis';

/**
 * 增量分析器配置接口
 */
export interface IIncrementalAnalyzerOptions {
  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 基准提交SHA或分支名（默认为最近一次提交）
   */
  baseCommit?: string;

  /**
   * 当前提交SHA或分支名（默认为工作区）
   */
  currentCommit?: string;

  /**
   * 缓存目录（存储历史分析结果）
   */
  cacheDir?: string;

  /**
   * 要分析的文件扩展名
   */
  fileExtensions?: string[];
}

/**
 * 增量分析器
 * 提供Git版本间差异分析和结果对比功能
 */
export class IncrementalAnalyzer {
  private options: IIncrementalAnalyzerOptions;
  private cacheDir: string;

  constructor(options: IIncrementalAnalyzerOptions) {
    this.options = {
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      ...options,
    };

    this.cacheDir =
      this.options.cacheDir ||
      path.join(this.options.projectRoot, '.code-insight-cache');

    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 获取增量分析信息
   * @returns 增量分析信息
   */
  async getIncrementalInfo(): Promise<IIncrementalInfo> {
    try {
      // 检查是否在Git仓库中
      if (!this.isGitRepository()) {
        return { changedFiles: [] };
      }

      const baseCommit = this.options.baseCommit || this.getLastCommitHash();
      const currentCommit = this.options.currentCommit || 'HEAD';

      // 获取变更文件列表
      const changedFiles = this.getChangedFiles(baseCommit, currentCommit);

      // 过滤出匹配扩展名的文件
      const filteredChangedFiles = changedFiles.filter((file) => {
        const ext = path.extname(file);
        return this.options.fileExtensions!.includes(ext);
      });

      return {
        baseCommit,
        currentCommit:
          currentCommit === 'HEAD'
            ? this.getCurrentCommitHash()
            : currentCommit,
        changedFiles: filteredChangedFiles,
      };
    } catch (error) {
      console.error('获取增量分析信息失败:', error);
      return { changedFiles: [] };
    }
  }

  /**
   * 保存分析结果到缓存
   * @param commit 提交SHA
   * @param results 分析结果
   */
  async saveResultsToCache(commit: string, results: any): Promise<void> {
    try {
      // 使用提交SHA作为缓存键
      const cacheFile = path.join(this.cacheDir, `${commit}.json`);

      await fsPromises.writeFile(cacheFile, JSON.stringify(results, null, 2));
    } catch (error) {
      console.error('保存分析结果到缓存失败:', error);
    }
  }

  /**
   * 从缓存加载分析结果
   * @param commit 提交SHA
   * @returns 分析结果，如果不存在则返回null
   */
  async loadResultsFromCache(commit: string): Promise<any | null> {
    try {
      const cacheFile = path.join(this.cacheDir, `${commit}.json`);

      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const content = await fsPromises.readFile(cacheFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('从缓存加载分析结果失败:', error);
      return null;
    }
  }

  /**
   * 比较两次分析结果，计算变化趋势
   * @param baseResults 基准分析结果
   * @param currentResults 当前分析结果
   * @returns 包含趋势信息的增量分析结果
   */
  calculateTrends(baseResults: any, currentResults: any): IIncrementalInfo {
    const trends: any = {};

    // 计算代码覆盖率变化
    if (baseResults.coverage && currentResults.coverage) {
      const baseAvgCoverage = this.calculateAverageCoverage(
        baseResults.coverage
      );
      const currentAvgCoverage = this.calculateAverageCoverage(
        currentResults.coverage
      );
      trends.coverageTrend = currentAvgCoverage - baseAvgCoverage;
    }

    // 计算重复代码变化
    if (baseResults.duplicates && currentResults.duplicates) {
      const baseDuplication = baseResults.duplicates.totalDuplicationRate;
      const currentDuplication = currentResults.duplicates.totalDuplicationRate;
      trends.duplicationTrend = currentDuplication - baseDuplication;
    }

    // 计算未使用代码变化
    if (baseResults.unusedCode && currentResults.unusedCode) {
      const baseUnusedCount = this.countUnusedItems(baseResults.unusedCode);
      const currentUnusedCount = this.countUnusedItems(
        currentResults.unusedCode
      );

      // 计算相对于代码总量的比例变化
      const baseTotal = baseResults.stats.totalLines || 1;
      const currentTotal = currentResults.stats.totalLines || 1;

      const baseRatio = baseUnusedCount / baseTotal;
      const currentRatio = currentUnusedCount / currentTotal;

      trends.unusedCodeTrend = currentRatio - baseRatio;
    }

    // 计算循环依赖变化
    if (
      baseResults.dependencies?.circularDependencies &&
      currentResults.dependencies?.circularDependencies
    ) {
      const baseCircular = baseResults.dependencies.circularDependencies.length;
      const currentCircular =
        currentResults.dependencies.circularDependencies.length;

      // 计算相对于总依赖的比例变化
      const baseDepsCount =
        Object.keys(baseResults.dependencies.dependencyGraph || {}).length || 1;
      const currentDepsCount =
        Object.keys(currentResults.dependencies.dependencyGraph || {}).length ||
        1;

      const baseRatio = baseCircular / baseDepsCount;
      const currentRatio = currentCircular / currentDepsCount;

      trends.circularDependenciesTrend = currentRatio - baseRatio;
    }

    return {
      baseCommit: this.options.baseCommit,
      currentCommit: this.options.currentCommit || this.getCurrentCommitHash(),
      changedFiles: this.getChangedFiles(
        this.options.baseCommit || this.getLastCommitHash(),
        this.options.currentCommit || 'HEAD'
      ),
      trends,
    };
  }

  /**
   * 生成文件内容的哈希
   * @param filePath 文件路径
   * @returns 文件哈希值
   */
  async generateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('md5');
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      console.error(`生成文件哈希失败: ${filePath}`, error);
      return '';
    }
  }

  /**
   * 确定是否需要重新分析文件
   * @param filePath 文件路径
   * @returns 是否需要重新分析
   */
  async shouldReanalyzeFile(filePath: string): Promise<boolean> {
    const cacheDir = path.join(this.cacheDir, 'files');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const fileRelativePath = path.relative(this.options.projectRoot, filePath);
    const cacheFile = path.join(
      cacheDir,
      fileRelativePath.replace(/[/\\]/g, '_') + '.hash'
    );

    const currentHash = await this.generateFileHash(filePath);
    if (!currentHash) return true;

    try {
      if (fs.existsSync(cacheFile)) {
        const savedHash = (
          await fsPromises.readFile(cacheFile, 'utf-8')
        ).trim();

        if (savedHash === currentHash) {
          return false; // 文件未变更，无需重新分析
        }
      }

      // 更新文件哈希
      await fsPromises.mkdir(path.dirname(cacheFile), { recursive: true });
      await fsPromises.writeFile(cacheFile, currentHash);

      return true; // 文件已变更或首次分析，需要重新分析
    } catch (error) {
      console.error(`检查文件变更失败: ${filePath}`, error);
      return true; // 出错时默认重新分析
    }
  }

  /**
   * 检查是否在Git仓库中
   * @returns 是否在Git仓库中
   */
  private isGitRepository(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.options.projectRoot,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取最近一次提交的哈希值
   * @returns 提交哈希值
   */
  private getLastCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD~1', {
        cwd: this.options.projectRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return execSync('git rev-parse HEAD', {
        cwd: this.options.projectRoot,
        encoding: 'utf-8',
      }).trim();
    }
  }

  /**
   * 获取当前提交的哈希值
   * @returns 提交哈希值
   */
  private getCurrentCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', {
        cwd: this.options.projectRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'working-copy';
    }
  }

  /**
   * 获取两次提交之间变更的文件列表
   * @param baseCommit 基准提交
   * @param currentCommit 当前提交
   * @returns 变更文件列表
   */
  private getChangedFiles(baseCommit: string, currentCommit: string): string[] {
    try {
      if (
        currentCommit === 'HEAD' ||
        currentCommit === this.getCurrentCommitHash()
      ) {
        // 如果是比较工作区，使用不同的命令
        const output = execSync(`git diff --name-only ${baseCommit}`, {
          cwd: this.options.projectRoot,
          encoding: 'utf-8',
        });
        return output.split('\n').filter(Boolean);
      } else {
        // 比较两个提交
        const output = execSync(
          `git diff --name-only ${baseCommit} ${currentCommit}`,
          { cwd: this.options.projectRoot, encoding: 'utf-8' }
        );
        return output.split('\n').filter(Boolean);
      }
    } catch (error) {
      console.error('获取变更文件列表失败:', error);
      return [];
    }
  }

  /**
   * 计算平均代码覆盖率
   * @param coverageResults 覆盖率结果
   * @returns 平均覆盖率（0-1之间）
   */
  private calculateAverageCoverage(coverageResults: any[]): number {
    if (!coverageResults || coverageResults.length === 0) {
      return 0;
    }

    let totalLineCoverage = 0;

    coverageResults.forEach((file) => {
      totalLineCoverage += file.lineCoverage;
    });

    return totalLineCoverage / coverageResults.length;
  }

  /**
   * 计算未使用代码项目总数
   * @param unusedResults 未使用代码结果
   * @returns 未使用项目总数
   */
  private countUnusedItems(unusedResults: any): number {
    return (
      (unusedResults.unusedImports?.length || 0) +
      (unusedResults.unusedVariables?.length || 0) +
      (unusedResults.unusedFunctions?.length || 0) +
      (unusedResults.unusedClasses?.length || 0) +
      (unusedResults.unusedExports?.length || 0)
    );
  }
}
