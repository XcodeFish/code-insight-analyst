/**
 * 通用分析器接口
 * 所有具体分析器都应实现此接口
 */
export interface IAnalyzer<T> {
  /**
   * 执行分析逻辑
   * @returns 分析结果
   */
  analyze(): Promise<T>;
}
