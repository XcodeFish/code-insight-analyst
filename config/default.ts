/**
 * 默认配置
 */
import * as path from 'path';
import * as os from 'os';

export const config = {
  // 应用设置
  app: {
    name: 'code-insight-analyst',
    version: '0.1.0',
    description:
      '代码分析工具，用于检测代码质量、覆盖率、重复、未使用代码和潜在问题',
  },

  // 分析设置
  analysis: {
    // 默认分析类型
    defaultTypes: ['unused-code', 'method-dup'],
    // 完整分析类型
    allTypes: [
      'coverage',
      'method-dup',
      'unused-code',
      'dependencies',
      'memory-leak',
      'infinite-loop',
    ],
    // 实验性分析类型
    experimentalTypes: ['memory-leak', 'infinite-loop'],
    // 各分析项预计耗时(秒)
    estimatedTime: {
      coverage: 120,
      'method-dup': 60,
      'unused-code': 180,
      dependencies: 90,
      'memory-leak': 180,
      'infinite-loop': 120,
    },
    // 并行处理相关
    parallel: {
      maxWorkers: Math.max(1, os.cpus().length - 1), // 留一个核心给系统
      batchSize: 10,
    },
  },

  // 文件设置
  files: {
    // 默认忽略的文件/目录
    defaultIgnore: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.git',
      '.github',
      '.vscode',
    ],
    // 默认分析的文件类型
    defaultExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    // 最大并行处理文件数
    maxParallelFiles: 100,
  },

  // 报告设置
  report: {
    // 默认报告格式
    defaultFormat: 'html',
    // 支持的报告格式
    formats: ['html', 'json', 'console'],
    // 报告保存目录
    outputDir: './code-insight-reports',
    // 默认报告文件名
    defaultFilename: `code-insight-report-${new Date().toISOString().slice(0, 10)}`,
  },

  // 缓存设置
  cache: {
    // 是否启用缓存
    enabled: true,
    // 缓存目录
    cacheDir: path.join(os.homedir(), '.code-insight', 'cache'),
    // 缓存过期时间(小时)
    expiryHours: 24,
    // 最大缓存条目数
    maxItems: 1000,
  },

  // 安全设置
  security: {
    // 访问日志目录
    accessLogDir: path.join(os.homedir(), '.code-insight', 'logs'),
    // 是否记录详细访问日志
    detailedLogs: false,
    // 用户配置文件
    configFile: path.join(os.homedir(), '.code-insight-config.json'),
  },
};

export default config;
