import path from 'path';
import fs from 'fs';
import {
  DependencyGraph,
  DependencyNode,
  CircularDependency,
  DependencyAnalysisResult,
} from '../../types/dependency-types';
// 注：使用前需安装 madge 依赖
// 模拟 madge 功能，用于演示目的
// 在实际项目中，应该使用真正的 madge 库

// 模拟 madge 分析
const madge = async (
  projectPath: string
  // 移除未使用的参数
): Promise<{
  obj(): Record<string, string[]>;
  circular(): string[][];
}> => {
  console.info(`模拟分析项目依赖关系: ${projectPath}`);

  // 创建一个演示用的依赖图
  const mockDependencies: Record<string, string[]> = {
    'src/index.ts': [
      'src/core/analyzers/dependency-analyzer.ts',
      'src/services/dependency-service.ts',
    ],
    'src/cli/index.ts': ['src/cli/app.ts'],
    'src/cli/app.ts': [
      'src/cli/commands/dependency-command.ts',
      'src/cli/commands/watch-command.ts',
    ],
    'src/cli/commands/dependency-command.ts': [
      'src/services/dependency-service.ts',
    ],
    'src/cli/commands/watch-command.ts': ['src/services/watch-service.ts'],
    'src/services/dependency-service.ts': [
      'src/core/analyzers/dependency-analyzer.ts',
      'src/core/report/report-generator.ts',
    ],
    'src/services/watch-service.ts': [
      'src/core/analyzers/dependency-analyzer.ts',
    ],
    'src/core/analyzers/dependency-analyzer.ts': [
      'src/types/dependency-types.ts',
    ],
    'src/core/report/report-generator.ts': ['src/types/dependency-types.ts'],
    'src/types/dependency-types.ts': [],
  };

  // 模拟循环依赖
  const mockCircular = [
    [
      'src/index.ts',
      'src/core/analyzers/dependency-analyzer.ts',
      'src/types/dependency-types.ts',
      'src/index.ts',
    ],
  ];

  return {
    obj: () => mockDependencies,
    circular: () => mockCircular,
  };
};

/**
 * 依赖关系分析错误类
 */
export class DependencyAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(`[${code}] ${message}`);
    this.name = 'DependencyAnalysisError';
  }
}

/**
 * 依赖关系分析器
 * 用于分析项目中的文件依赖关系，检测循环依赖，分析依赖层次等
 */
export class DependencyAnalyzer {
  private readonly basePath: string;
  private readonly fileExtensions: string[];
  private graph: DependencyGraph | null = null;

  /**
   * 创建依赖分析器实例
   * @param basePath - 项目根路径
   * @param fileExtensions - 要分析的文件扩展名
   */
  constructor(
    basePath: string,
    fileExtensions: string[] = ['js', 'jsx', 'ts', 'tsx']
  ) {
    this.basePath = path.resolve(basePath);
    this.fileExtensions = fileExtensions;
  }

  /**
   * 构建项目的依赖关系图
   * @returns 依赖图对象
   */
  async buildGraph(): Promise<DependencyGraph> {
    // 检查项目路径是否存在
    if (!fs.existsSync(this.basePath)) {
      throw new DependencyAnalysisError(
        `项目路径不存在: ${this.basePath}`,
        'ERR_PATH_NOT_FOUND'
      );
    }

    try {
      // 使用madge分析项目依赖
      const madgeResult = await madge(this.basePath);

      // 转换madge结果为我们的依赖图格式
      const dependencyMap = (
        madgeResult as { obj(): Record<string, string[]> }
      ).obj();

      this.graph = {
        nodes: this.buildNodes(dependencyMap),
        edges: this.buildEdges(dependencyMap),
        circularDependencies: this.extractCircularDependencies(madgeResult),
      };

      return this.graph;
    } catch (error) {
      throw new DependencyAnalysisError(
        `依赖分析失败: ${(error as Error).message}`,
        'ERR_ANALYSIS_FAILED'
      );
    }
  }

  /**
   * 执行完整的依赖分析
   * @returns 完整的依赖分析结果
   */
  async analyze(): Promise<DependencyAnalysisResult> {
    if (!this.graph) {
      await this.buildGraph();
    }

    const graph = this.graph!;
    const levels = await this.getDependencyLevels();
    const counts = await this.getDependencyCounts();

    // 计算统计信息
    const stats = this.computeStats(graph, levels, counts);

    return {
      graph,
      levels,
      counts,
      stats,
    };
  }

  /**
   * 查找项目中的循环依赖
   * @returns 循环依赖列表
   */
  async getCircularDependencies(): Promise<CircularDependency[]> {
    if (!this.graph) {
      await this.buildGraph();
    }
    return this.graph?.circularDependencies || [];
  }

  /**
   * 获取依赖层级分析
   * @returns 每个文件的依赖层级信息
   */
  async getDependencyLevels(): Promise<Map<string, number>> {
    if (!this.graph) {
      await this.buildGraph();
    }

    const levels = new Map<string, number>();
    const { nodes, edges } = this.graph!;

    const calculateLevel = (
      nodeId: string,
      visited = new Set<string>()
    ): number => {
      // 防止循环依赖导致无限递归
      if (visited.has(nodeId)) {
        return 0;
      }

      // 如果已计算过层级，直接返回
      if (levels.has(nodeId)) {
        return levels.get(nodeId)!;
      }

      // 找出当前节点的所有依赖
      const dependencies = edges
        .filter((edge): boolean => edge.target === nodeId)
        .map((edge): string => edge.source);

      if (dependencies.length === 0) {
        // 没有依赖的节点为0级
        levels.set(nodeId, 0);
        return 0;
      }

      // 标记为已访问
      visited.add(nodeId);

      // 计算所有依赖中的最大层级，然后+1
      const maxLevel = Math.max(
        ...dependencies.map((dep): number =>
          calculateLevel(dep, new Set([...visited]))
        )
      );

      const level = maxLevel + 1;
      levels.set(nodeId, level);
      return level;
    };

    // 计算每个节点的层级
    nodes.forEach((node): void => {
      calculateLevel(node.id);
    });

    return levels;
  }

  /**
   * 计算每个文件的依赖数量
   * @returns 每个文件的依赖数量统计
   */
  async getDependencyCounts(): Promise<
    Map<string, { incoming: number; outgoing: number }>
  > {
    if (!this.graph) {
      await this.buildGraph();
    }

    const counts = new Map<string, { incoming: number; outgoing: number }>();
    const { nodes, edges } = this.graph!;

    // 初始化计数器
    nodes.forEach((node): void => {
      counts.set(node.id, { incoming: 0, outgoing: 0 });
    });

    // 计算每个边的入边和出边
    edges.forEach((edge): void => {
      const source = counts.get(edge.source);
      const target = counts.get(edge.target);

      if (source) {
        source.outgoing += 1;
        counts.set(edge.source, source);
      }

      if (target) {
        target.incoming += 1;
        counts.set(edge.target, target);
      }
    });

    return counts;
  }

  /**
   * 计算各种统计信息
   */
  private computeStats(
    graph: DependencyGraph,
    levels: Map<string, number>,
    counts: Map<string, { incoming: number; outgoing: number }>
  ) {
    const totalFiles = graph.nodes.length;
    const totalDependencies = graph.edges.length;
    const circularDependencyCount = graph.circularDependencies.length;

    // 计算最大依赖层级
    let maxDependencyLevel = 0;
    levels.forEach((level) => {
      if (level > maxDependencyLevel) {
        maxDependencyLevel = level;
      }
    });

    // 找出被最多模块依赖的文件
    let mostDepended = { id: '', count: 0 };
    let mostDependsOn = { id: '', count: 0 };

    counts.forEach((count, id) => {
      if (count.incoming > mostDepended.count) {
        mostDepended = { id, count: count.incoming };
      }

      if (count.outgoing > mostDependsOn.count) {
        mostDependsOn = { id, count: count.outgoing };
      }
    });

    return {
      totalFiles,
      totalDependencies,
      circularDependencyCount,
      maxDependencyLevel,
      mostDepended,
      mostDependsOn,
    };
  }

  /**
   * 将madge依赖对象转换为节点列表
   */
  private buildNodes(
    dependencyMap: Record<string, string[]>
  ): DependencyNode[] {
    return Object.keys(dependencyMap).map((filePath) => ({
      id: filePath,
      path: path.resolve(this.basePath, filePath),
      size: this.getFileSize(path.resolve(this.basePath, filePath)),
    }));
  }

  /**
   * 将madge依赖对象转换为边列表
   */
  private buildEdges(
    dependencyMap: Record<string, string[]>
  ): { source: string; target: string }[] {
    const edges: { source: string; target: string }[] = [];

    Object.entries(dependencyMap).forEach(([file, dependencies]) => {
      dependencies.forEach((dependency) => {
        edges.push({
          source: dependency,
          target: file,
        });
      });
    });

    return edges;
  }

  /**
   * 从madge结果中提取循环依赖信息
   */
  private extractCircularDependencies(madgeResult: {
    circular(): string[][];
  }): CircularDependency[] {
    try {
      const circular = madgeResult.circular();

      return circular.map((dependencyCycle: string[], index: number) => ({
        id: `cycle-${index}`,
        cycle: dependencyCycle,
        length: dependencyCycle.length,
      }));
    } catch (error) {
      console.error('获取循环依赖失败:', error);
      return [];
    }
  }

  /**
   * 获取文件大小
   */
  private getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
