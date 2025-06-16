/**
 * 配置模式定义
 */

export interface AppConfig {
  name: string;
  version: string;
  description: string;
}

export interface AnalysisConfig {
  defaultTypes: string[];
  allTypes: string[];
  experimentalTypes: string[];
  estimatedTime: Record<string, number>;
  parallel: {
    maxWorkers: number;
    batchSize: number;
  };
}

export interface FilesConfig {
  defaultIgnore: string[];
  defaultExtensions: string[];
  maxParallelFiles: number;
}

export interface ReportConfig {
  defaultFormat: string;
  formats: string[];
  outputDir: string;
  defaultFilename: string;
}

export interface CacheConfig {
  enabled: boolean;
  cacheDir: string;
  expiryHours: number;
  maxItems: number;
}

export interface SecurityConfig {
  accessLogDir: string;
  detailedLogs: boolean;
  configFile: string;
}

export interface Config {
  app: AppConfig;
  analysis: AnalysisConfig;
  files: FilesConfig;
  report: ReportConfig;
  cache: CacheConfig;
  security: SecurityConfig;
}

/**
 * 用户配置文件(.insightrc)模式
 */
export interface UserConfig {
  ignore?: string[];
  extensions?: string[];
  analysisTypes?: string[];
  report?: {
    format?: string;
    output?: string;
  };
  customRules?: Record<string, unknown>;
  analysisProfiles?: Record<string, string[]>;
  cache?: {
    enabled?: boolean;
  };
}

export default Config;
