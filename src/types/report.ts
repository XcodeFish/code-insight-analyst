import { IAnalysisResult } from './analysis';

/**
 * 报告生成器选项接口
 */
export interface IReportOptions {
  /**
   * 输出路径
   */
  outputPath?: string;

  /**
   * 报告标题
   */
  title?: string;

  /**
   * 是否包含详细信息
   */
  detailed?: boolean;

  /**
   * 是否包含图表
   */
  includeCharts?: boolean;

  /**
   * 项目名称
   */
  projectName?: string;

  /**
   * 生成时间
   */
  timestamp?: Date;

  /**
   * 自定义模板路径
   */
  templatePath?: string;
}

/**
 * 图表数据类型
 */
export interface IChartData {
  /**
   * 图表标题
   */
  title: string;

  /**
   * 图表类型
   */
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';

  /**
   * 图表标签
   */
  labels: string[];

  /**
   * 图表数据集
   */
  datasets: Array<{
    /**
     * 数据集标签
     */
    label?: string;

    /**
     * 数据集数据
     */
    data: number[];

    /**
     * 背景颜色
     */
    backgroundColor?: string | string[];

    /**
     * 边框颜色
     */
    borderColor?: string | string[];
  }>;
}

/**
 * 报告生成器接口
 */
export interface IReportGenerator {
  /**
   * 生成报告
   * @param results 分析结果
   * @returns 报告文件路径
   */
  generate(results: IAnalysisResult): Promise<string | null>;

  /**
   * 准备图表数据
   * @param results 分析结果
   * @returns 图表数据
   */
  prepareChartData?(results: IAnalysisResult): IChartData[];
}
