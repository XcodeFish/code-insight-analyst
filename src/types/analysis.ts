/**
 * 单个文件的分析位置信息
 */
export interface ILocation {
  /**
   * 文件路径
   */
  filePath: string;

  /**
   * 开始行号
   */
  startLine?: number;

  /**
   * 结束行号
   */
  endLine?: number;

  /**
   * 开始列号
   */
  startColumn?: number;

  /**
   * 结束列号
   */
  endColumn?: number;
}

/**
 * 代码覆盖率分析结果
 */
export interface ICoverageResult {
  /**
   * 文件路径
   */
  filePath: string;

  /**
   * 行覆盖率
   */
  lineCoverage: number;

  /**
   * 语句覆盖率
   */
  statementCoverage: number;

  /**
   * 分支覆盖率
   */
  branchCoverage: number;

  /**
   * 函数覆盖率
   */
  functionCoverage: number;

  /**
   * 未覆盖的行
   */
  uncoveredLines: number[];
}

/**
 * 重复代码分析结果
 */
export interface IDuplicateResult {
  /**
   * 重复代码块
   */
  duplicates: Array<{
    /**
     * 重复代码的位置信息
     */
    locations: ILocation[];

    /**
     * 重复代码的行数
     */
    lines: number;

    /**
     * 重复代码的相似度
     */
    similarity: number;

    /**
     * 重复代码的片段
     */
    snippet?: string;
  }>;

  /**
   * 总重复率
   */
  totalDuplicationRate: number;
}

/**
 * 未使用代码分析结果
 */
export interface IUnusedCodeResult {
  /**
   * 未使用的导入
   */
  unusedImports: ILocation[];

  /**
   * 未使用的变量
   */
  unusedVariables: ILocation[];

  /**
   * 未使用的函数
   */
  unusedFunctions: ILocation[];

  /**
   * 未使用的类
   */
  unusedClasses: ILocation[];

  /**
   * 未使用的导出
   */
  unusedExports: ILocation[];
}

/**
 * 依赖关系分析结果
 */
export interface IDependencyResult {
  /**
   * 依赖图（邻接表表示）
   */
  dependencyGraph: Record<string, string[]>;

  /**
   * 循环依赖
   */
  circularDependencies: Array<string[]>;

  /**
   * 未使用的依赖
   */
  unusedDependencies: string[];

  /**
   * 缺失的依赖
   */
  missingDependencies: string[];
}

/**
 * 内存泄漏分析结果
 */
export interface IMemoryLeakResult {
  /**
   * 可能导致内存泄漏的代码
   */
  potentialLeaks: Array<{
    /**
     * 位置信息
     */
    location: ILocation;

    /**
     * 泄漏风险级别
     */
    riskLevel: 'low' | 'medium' | 'high';

    /**
     * 泄漏类型
     */
    type: string;

    /**
     * 描述
     */
    description: string;
  }>;
}

/**
 * 死循环检测结果
 */
export interface IInfiniteLoopResult {
  /**
   * 可能的无限循环
   */
  potentialInfiniteLoops: Array<{
    /**
     * 位置信息
     */
    location: ILocation;

    /**
     * 风险级别
     */
    riskLevel: 'low' | 'medium' | 'high';

    /**
     * 原因
     */
    reason: string;

    /**
     * 修复建议
     */
    suggestion?: string;
  }>;
}

/**
 * 增量分析相关信息
 */
export interface IIncrementalInfo {
  /**
   * 基准提交 SHA
   */
  baseCommit?: string;

  /**
   * 当前提交 SHA
   */
  currentCommit?: string;

  /**
   * 改动文件列表
   */
  changedFiles: string[];

  /**
   * 与基准对比的变化趋势
   */
  trends?: {
    /**
     * 代码覆盖率变化
     */
    coverageTrend?: number;

    /**
     * 重复代码变化
     */
    duplicationTrend?: number;

    /**
     * 未使用代码变化
     */
    unusedCodeTrend?: number;

    /**
     * 循环依赖变化
     */
    circularDependenciesTrend?: number;
  };
}

/**
 * 自定义规则分析结果
 */
export interface ICustomRuleResult {
  /**
   * 规则名称
   */
  ruleName: string;

  /**
   * 规则描述
   */
  description: string;

  /**
   * 触发的问题
   */
  issues: Array<{
    /**
     * 位置信息
     */
    location: ILocation;

    /**
     * 严重性
     */
    severity: 'info' | 'warning' | 'error';

    /**
     * 消息
     */
    message: string;

    /**
     * 修复建议
     */
    suggestion?: string;
  }>;
}

/**
 * 分析结果的统计信息
 */
export interface IAnalysisStats {
  /**
   * 总文件数量
   */
  totalFiles: number;

  /**
   * 总代码行数
   */
  totalLines: number;

  /**
   * 分析开始时间
   */
  startTime: Date;

  /**
   * 分析结束时间
   */
  endTime: Date;

  /**
   * 分析耗时（毫秒）
   */
  duration: number;
}

/**
 * 完整分析结果
 */
export interface IAnalysisResult {
  /**
   * 项目名称
   */
  projectName: string;

  /**
   * 分析统计信息
   */
  stats: IAnalysisStats;

  /**
   * 代码覆盖率结果
   */
  coverage?: ICoverageResult[];

  /**
   * 重复代码结果
   */
  duplicates?: IDuplicateResult;

  /**
   * 未使用代码结果
   */
  unusedCode?: IUnusedCodeResult;

  /**
   * 依赖关系结果
   */
  dependencies?: IDependencyResult;

  /**
   * 内存泄漏结果
   */
  memoryLeaks?: IMemoryLeakResult;

  /**
   * 死循环检测结果
   */
  infiniteLoops?: IInfiniteLoopResult;

  /**
   * 自定义规则结果
   */
  customRules?: ICustomRuleResult[];

  /**
   * 增量分析信息
   */
  incrementalInfo?: IIncrementalInfo;
}
