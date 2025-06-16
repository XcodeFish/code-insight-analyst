/**
 * 基础分析结果接口
 * 所有分析结果类型必须包含这些基本属性
 */
export interface AnalysisResult {
  /**
   * 分析执行时间（毫秒）
   */
  duration: number;
}
