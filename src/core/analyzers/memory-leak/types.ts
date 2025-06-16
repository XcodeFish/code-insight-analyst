/**
 * 资源类型枚举
 */
export enum ResourceType {
  FILE_STREAM = 'FILE_STREAM',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  NETWORK_CONNECTION = 'NETWORK_CONNECTION',
  MEMORY_BUFFER = 'MEMORY_BUFFER',
}

/**
 * 资源使用情况接口
 */
export interface ResourceUsage {
  resourceId: string;
  resourceType: ResourceType;
  isCreated: boolean;
  isReleased: boolean;
  location: { line: number; column: number };
  variableName?: string;
}

/**
 * 内存泄漏严重程度枚举
 */
export enum LeakSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * 基础泄漏警告接口
 */
export interface BaseLeakWarning {
  type: string;
  message: string;
  location: { line: number; column: number };
  severity: LeakSeverity;
  filePath: string;
}

/**
 * 资源泄漏警告接口
 */
export interface ResourceLeakWarning extends BaseLeakWarning {
  type: 'resource-leak';
  resourceType: ResourceType;
}

/**
 * 闭包泄漏信息接口
 */
export interface ClosureLeakInfo extends BaseLeakWarning {
  type: 'closure-leak';
  containerName: string;
  closureVars: string[];
}

/**
 * 事件监听器泄漏警告接口
 */
export interface EventListenerLeakWarning extends BaseLeakWarning {
  type: 'event-listener-leak';
}

/**
 * 定时器泄漏警告接口
 */
export interface TimerLeakWarning extends BaseLeakWarning {
  type: 'timer-leak';
}

/**
 * 泄漏警告联合类型
 */
export type LeakWarning =
  | ResourceLeakWarning
  | ClosureLeakInfo
  | EventListenerLeakWarning
  | TimerLeakWarning;
