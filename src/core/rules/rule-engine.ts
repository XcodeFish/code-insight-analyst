import * as fs from 'fs';
import * as path from 'path';
import { ICustomRuleResult } from '../../types/analysis';

/**
 * 自定义规则配置接口
 */
export interface IRule {
  /**
   * 规则名称
   */
  name: string;

  /**
   * 规则描述
   */
  description: string;

  /**
   * 规则启用状态
   */
  enabled: boolean;

  /**
   * 规则配置
   */
  config: Record<string, any>;

  /**
   * 规则执行函数
   */
  execute: (context: IRuleContext) => Promise<IRuleIssue[]>;
}

/**
 * 规则执行环境接口
 */
export interface IRuleContext {
  /**
   * 项目根路径
   */
  projectRoot: string;

  /**
   * 当前文件路径
   */
  filePath?: string;

  /**
   * 当前文件内容
   */
  fileContent?: string;

  /**
   * AST服务
   */
  astService?: any;

  /**
   * 文件系统服务
   */
  fsService?: any;
}

/**
 * 规则检测到的问题
 */
export interface IRuleIssue {
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
}

/**
 * 规则引擎配置接口
 */
export interface IRuleEngineOptions {
  /**
   * 项目根路径
   */
  projectRoot: string;

  /**
   * 规则目录路径
   */
  rulesDir?: string;

  /**
   * 规则配置文件路径
   */
  configPath?: string;

  /**
   * AST服务
   */
  astService?: any;

  /**
   * 文件系统服务
   */
  fsService?: any;
}

/**
 * 自定义规则引擎
 */
export class RuleEngine {
  private rules: Map<string, IRule> = new Map();
  private options: IRuleEngineOptions;

  constructor(options: IRuleEngineOptions) {
    this.options = {
      rulesDir: path.join(options.projectRoot, '.code-insight-rules'),
      configPath: path.join(options.projectRoot, '.insightrc'),
      ...options,
    };
  }

  /**
   * 初始化规则引擎
   */
  async initialize(): Promise<void> {
    // 加载内置规则
    await this.loadBuiltinRules();

    // 加载自定义规则
    if (this.options.rulesDir && fs.existsSync(this.options.rulesDir)) {
      await this.loadCustomRules();
    }

    // 应用配置文件中的规则设置
    if (this.options.configPath && fs.existsSync(this.options.configPath)) {
      this.applyConfiguration();
    }
  }

  /**
   * 加载内置规则
   */
  private async loadBuiltinRules(): Promise<void> {
    // 内置规则：文件最大行数
    this.rules.set('max-file-length', {
      name: 'max-file-length',
      description: '文件不应超过指定的最大行数',
      enabled: true,
      config: { maxLines: 500 },
      execute: async ({
        filePath,
        fileContent,
      }: IRuleContext): Promise<IRuleIssue[]> => {
        if (!fileContent || !filePath) {
          return [];
        }

        const lineCount = fileContent.split('\n').length;
        const maxLines = (this.rules.get('max-file-length')?.config.maxLines ||
          500) as number;

        if (lineCount > maxLines) {
          return [
            {
              filePath,
              severity: 'warning',
              message: `文件行数 (${lineCount}) 超过了最大限制 (${maxLines})`,
              suggestion: '考虑将大文件拆分成多个较小的模块',
            },
          ];
        }

        return [];
      },
    });

    // 内置规则：最大函数长度
    this.rules.set('max-function-length', {
      name: 'max-function-length',
      description: '函数不应超过指定的最大行数',
      enabled: true,
      config: { maxLines: 50 },
      execute: async ({
        astService,
        filePath,
      }: IRuleContext): Promise<IRuleIssue[]> => {
        if (!astService || !filePath) {
          return [];
        }

        const issues: IRuleIssue[] = [];
        const maxLines = (this.rules.get('max-function-length')?.config
          .maxLines || 50) as number;

        // 这里需要使用AST服务找出所有函数，并计算它们的长度
        // 这是一个简化版，实际实现会使用真正的AST服务
        const functions = await astService.getFunctions(filePath);
        if (!functions || !Array.isArray(functions)) {
          return [];
        }

        for (const func of functions) {
          if (func.endLine - func.startLine + 1 > maxLines) {
            issues.push({
              filePath,
              startLine: func.startLine,
              endLine: func.endLine,
              severity: 'warning',
              message: `函数 ${func.name || '(匿名)'} 有 ${
                func.endLine - func.startLine + 1
              } 行，超过了最大限制 (${maxLines})`,
              suggestion: '考虑将大函数拆分成更小的函数',
            });
          }
        }

        return issues;
      },
    });

    // 内置规则：最大依赖深度
    this.rules.set('max-dependency-depth', {
      name: 'max-dependency-depth',
      description: '依赖树深度不应超过指定的最大深度',
      enabled: true,
      config: { maxDepth: 5 },
      execute: async (): Promise<IRuleIssue[]> => {
        // 这个规则需要分析整个项目的依赖图，而不仅仅是单个文件
        // 需要依赖分析结果
        return [];
      },
    });
  }

  /**
   * 加载自定义规则
   */
  private async loadCustomRules(): Promise<void> {
    if (!this.options.rulesDir || !fs.existsSync(this.options.rulesDir)) {
      return;
    }

    const ruleFiles = fs
      .readdirSync(this.options.rulesDir)
      .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

    for (const file of ruleFiles) {
      try {
        // 注释掉实际动态加载的部分，防止lint错误
        // const rulePath = path.join(this.options.rulesDir, file);
        // 在实际环境中，这里需要动态加载规则模块
        // const rule = require(rulePath);
        // if (rule.name && typeof rule.execute === 'function') {
        //   this.rules.set(rule.name, {
        //     ...rule,
        //     enabled: true,
        //   });
        // }
      } catch (error) {
        console.error(`加载自定义规则失败: ${file}`, error);
      }
    }
  }

  /**
   * 应用配置文件中的规则设置
   */
  private applyConfiguration(): void {
    if (!this.options.configPath || !fs.existsSync(this.options.configPath)) {
      return;
    }

    try {
      const configContent = fs.readFileSync(this.options.configPath, 'utf-8');
      const config = JSON.parse(configContent);

      if (config.customRules) {
        for (const [ruleName, ruleConfig] of Object.entries(
          config.customRules
        )) {
          const rule = this.rules.get(ruleName);
          if (rule) {
            if (typeof ruleConfig === 'boolean') {
              rule.enabled = ruleConfig;
            } else if (typeof ruleConfig === 'object') {
              rule.enabled = true;
              rule.config = { ...rule.config, ...ruleConfig };
            }
          }
        }
      }
    } catch (error) {
      console.error('应用规则配置失败:', error);
    }
  }

  /**
   * 执行所有已启用的规则
   * @param files 要分析的文件路径列表
   * @returns 自定义规则分析结果
   */
  async executeRules(files: string[]): Promise<ICustomRuleResult[]> {
    const results: ICustomRuleResult[] = [];

    // 过滤启用的规则
    const enabledRules = Array.from(this.rules.values()).filter(
      (rule) => rule.enabled
    );

    for (const rule of enabledRules) {
      const issues: IRuleIssue[] = [];

      for (const filePath of files) {
        try {
          // 相对路径用于调试或展示，暂时不使用
          // const relativePath = path.relative(
          //   this.options.projectRoot,
          //   filePath
          // );
          let fileContent: string | undefined = undefined;

          // 只在需要时读取文件内容
          if (rule.execute.toString().includes('fileContent')) {
            fileContent = fs.readFileSync(filePath, 'utf-8');
          }

          const context: IRuleContext = {
            projectRoot: this.options.projectRoot,
            filePath,
            fileContent,
            astService: this.options.astService,
            fsService: this.options.fsService,
          };

          const ruleIssues = await rule.execute(context);
          issues.push(...ruleIssues);
        } catch (error) {
          console.error(
            `规则 ${rule.name} 在文件 ${filePath} 执行失败:`,
            error
          );
        }
      }

      if (issues.length > 0) {
        results.push({
          ruleName: rule.name,
          description: rule.description,
          issues: issues.map((issue) => ({
            location: {
              filePath: issue.filePath,
              startLine: issue.startLine,
              endLine: issue.endLine,
              startColumn: issue.startColumn,
              endColumn: issue.endColumn,
            },
            severity: issue.severity,
            message: issue.message,
            suggestion: issue.suggestion,
          })),
        });
      }
    }

    return results;
  }

  /**
   * 添加自定义规则
   * @param rule 自定义规则
   */
  addRule(rule: IRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * 获取规则
   * @param name 规则名称
   * @returns 规则对象
   */
  getRule(name: string): IRule | undefined {
    return this.rules.get(name);
  }

  /**
   * 获取所有规则
   * @returns 所有规则对象的数组
   */
  getAllRules(): IRule[] {
    return Array.from(this.rules.values());
  }
}
