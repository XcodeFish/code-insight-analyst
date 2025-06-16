/**
 * 依赖图节点定义
 */
export interface DependencyNode {
  /**
   * 节点唯一标识，通常是文件路径
   */
  id: string;

  /**
   * 节点对应文件的绝对路径
   */
  path: string;

  /**
   * 文件大小（字节）
   */
  size: number;
}

/**
 * 循环依赖信息
 */
export interface CircularDependency {
  /**
   * 循环依赖的文件路径数组
   */
  cycle: string[];

  /**
   * 循环依赖的长度
   */
  length: number;
}

/**
 * 依赖关系图
 */
export interface DependencyGraph {
  /**
   * 图中的所有节点
   */
  nodes: DependencyNode[];

  /**
   * 图中的依赖关系边
   */
  edges: { source: string; target: string }[];

  /**
   * 项目中的循环依赖
   */
  circularDependencies: CircularDependency[];
}

/**
 * 依赖分析结果
 */
export interface DependencyAnalysisResult {
  /**
   * 依赖关系图
   */
  graph: DependencyGraph;

  /**
   * 各节点的依赖层级
   */
  levels?: Map<string, number>;

  /**
   * 各节点的依赖计数
   */
  counts?: Map<string, { incoming: number; outgoing: number }>;

  /**
   * 分析的统计数据
   */
  stats: {
    totalFiles: number;
    totalDependencies: number;
    circularDependencyCount: number;
    maxDependencyLevel: number;
    mostDepended: { id: string; count: number };
    mostDependsOn: { id: string; count: number };
  };
}
