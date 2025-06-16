/**
 * 循环类型枚举
 */
export enum LoopType {
  FOR = 'for循环',
  WHILE = 'while循环',
  DO_WHILE = 'do-while循环',
  FOR_OF = 'for-of循环',
  FOR_IN = 'for-in循环',
  RECURSIVE = '递归调用',
}

/**
 * 循环风险等级枚举
 */
export enum LoopRiskLevel {
  LOW = '低',
  MEDIUM = '中',
  HIGH = '高',
  CRITICAL = '严重',
}

/**
 * 循环问题类型枚举
 */
export enum LoopIssueType {
  NO_CONDITION_CHANGE = '循环条件变量未修改',
  WRONG_CONDITION_DIRECTION = '条件变量更新方向错误',
  NO_EXIT_CONDITION = '缺少退出条件',
  RECURSIVE_NO_BASE_CASE = '递归缺少基本情况',
  COMPLEX_CONDITION = '复杂循环条件可能导致无限循环',
  NESTED_LOOP = '过深的嵌套循环',
  ASYNC_LOOP = '异步循环可能无限执行',
}

/**
 * 循环位置信息
 */
export interface LoopPosition {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  filePath: string;
}

/**
 * 循环信息基本接口
 */
export interface LoopInfo {
  type: LoopType;
  position: LoopPosition;
  risk: LoopRiskLevel;
}

/**
 * for循环信息
 */
export interface ForLoopInfo extends LoopInfo {
  type: LoopType.FOR;
  initExpression?: string;
  condition?: string;
  updateExpression?: string;
  bodyHasBreak: boolean;
  bodyHasReturn: boolean;
}

/**
 * while循环信息
 */
export interface WhileLoopInfo extends LoopInfo {
  type: LoopType.WHILE;
  condition: string;
  conditionVars: string[];
  bodyUpdatesConditionVars: boolean;
  bodyHasBreak: boolean;
  bodyHasReturn: boolean;
}

/**
 * do-while循环信息
 */
export interface DoWhileLoopInfo extends LoopInfo {
  type: LoopType.DO_WHILE;
  condition: string;
  conditionVars: string[];
  bodyUpdatesConditionVars: boolean;
  bodyHasBreak: boolean;
  bodyHasReturn: boolean;
}

/**
 * for-of或for-in循环信息
 */
export interface ForOfInLoopInfo extends LoopInfo {
  type: LoopType.FOR_OF | LoopType.FOR_IN;
  iterator: string;
  iterable: string;
  bodyHasBreak: boolean;
  bodyHasReturn: boolean;
}

/**
 * 递归函数信息
 */
export interface RecursiveCallInfo extends LoopInfo {
  type: LoopType.RECURSIVE;
  functionName: string;
  hasBaseCase: boolean;
  parameterChanges: string[];
}

/**
 * 循环信息类型
 */
export type LoopInfoType =
  | ForLoopInfo
  | WhileLoopInfo
  | DoWhileLoopInfo
  | ForOfInLoopInfo
  | RecursiveCallInfo;

/**
 * 潜在无限循环问题
 */
export interface PotentialInfiniteLoop {
  loopInfo: LoopInfo;
  issueType: LoopIssueType;
  message: string;
  risk: LoopRiskLevel;
  code: string;
  suggestion: string;
}
