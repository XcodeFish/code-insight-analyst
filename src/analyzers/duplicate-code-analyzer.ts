import { Project, Node, SourceFile, SyntaxKind } from 'ts-morph';
import { createHash } from 'crypto';
import { IAnalyzer } from '../interfaces/analyzer';
import { AnalysisResult } from '../types/analysis-result';

/**
 * 表示一段可能重复的代码
 */
export interface IDuplicateInfo {
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
  name: string;
  fingerprint: string;
  codeText: string;
  size: number;
}

/**
 * 表示重复代码分析结果
 */
export interface IDuplicateAnalysisResult extends AnalysisResult {
  duplicates: Map<string, IDuplicateInfo[]>;
  totalDuplicates: number;
  duplicateLines: number;
  affectedFiles: string[];
}

/**
 * 负责检测代码库中的重复代码
 */
export class DuplicateCodeAnalyzer
  implements IAnalyzer<IDuplicateAnalysisResult>
{
  private project: Project;
  private minDuplicateLines: number;

  /**
   * 创建重复代码分析器实例
   * @param projectPath 项目根路径
   * @param minDuplicateLines 最小重复行数阈值（默认为5）
   */
  constructor(projectPath: string, minDuplicateLines = 5) {
    this.project = new Project({
      tsConfigFilePath: `${projectPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    });
    this.project.addSourceFilesAtPaths([
      `${projectPath}/src/**/*.ts`,
      `${projectPath}/src/**/*.tsx`,
    ]);
    this.minDuplicateLines = minDuplicateLines;
  }

  /**
   * 执行重复代码分析
   * @returns 分析结果
   */
  async analyze(): Promise<IDuplicateAnalysisResult> {
    const startTime = Date.now();
    console.info('开始检测重复代码...');

    // 收集所有可能重复的代码单元（方法、类等）
    const codeUnits: IDuplicateInfo[] = [];

    for (const sourceFile of this.project.getSourceFiles()) {
      // 分析函数声明
      this.extractFunctions(sourceFile, codeUnits);

      // 分析方法声明
      this.extractMethods(sourceFile, codeUnits);

      // 分析箭头函数
      this.extractArrowFunctions(sourceFile, codeUnits);
    }

    // 检测重复代码
    const result = this.findDuplicates(codeUnits);

    const endTime = Date.now();

    return {
      duplicates: result.duplicateMap,
      totalDuplicates: result.totalDuplicates,
      duplicateLines: result.duplicateLines,
      affectedFiles: [
        ...new Set(
          Array.from(result.duplicateMap.values())
            .flat()
            .map((d) => d.filePath)
        ),
      ],
      duration: endTime - startTime,
    };
  }

  /**
   * 提取源文件中的函数声明
   * @param sourceFile 源文件
   * @param codeUnits 代码单元集合
   */
  private extractFunctions(
    sourceFile: SourceFile,
    codeUnits: IDuplicateInfo[]
  ): void {
    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const body = func.getBody();
      if (!body) continue;

      const bodyText = body.getText();
      if (this.countLines(bodyText) < this.minDuplicateLines) {
        continue;
      }

      codeUnits.push({
        filePath: sourceFile.getFilePath(),
        startLine: func.getStartLineNumber(),
        endLine: func.getEndLineNumber(),
        type: 'function',
        name: func.getName() || '匿名函数',
        fingerprint: this.generateFingerprint(bodyText),
        codeText: bodyText,
        size: this.countLines(bodyText),
      });
    }
  }

  /**
   * 提取源文件中的方法声明
   * @param sourceFile 源文件
   * @param codeUnits 代码单元集合
   */
  private extractMethods(
    sourceFile: SourceFile,
    codeUnits: IDuplicateInfo[]
  ): void {
    const classes = sourceFile.getClasses();

    for (const cls of classes) {
      const methods = cls.getMethods();

      for (const method of methods) {
        const body = method.getBody();
        if (!body) continue;

        const bodyText = body.getText();
        if (this.countLines(bodyText) < this.minDuplicateLines) {
          continue;
        }

        codeUnits.push({
          filePath: sourceFile.getFilePath(),
          startLine: method.getStartLineNumber(),
          endLine: method.getEndLineNumber(),
          type: 'method',
          name: `${cls.getName()}.${method.getName()}`,
          fingerprint: this.generateFingerprint(bodyText),
          codeText: bodyText,
          size: this.countLines(bodyText),
        });
      }
    }
  }

  /**
   * 提取源文件中的箭头函数
   * @param sourceFile 源文件
   * @param codeUnits 代码单元集合
   */
  private extractArrowFunctions(
    sourceFile: SourceFile,
    codeUnits: IDuplicateInfo[]
  ): void {
    const arrowFunctions = sourceFile.getDescendantsOfKind(
      SyntaxKind.ArrowFunction
    );

    for (const arrowFunc of arrowFunctions) {
      const body = arrowFunc.getBody();
      if (!body) continue;

      const bodyText = body.getText();
      if (this.countLines(bodyText) < this.minDuplicateLines) {
        continue;
      }

      // 尝试获取变量声明名称
      let name = '匿名箭头函数';
      const parent = arrowFunc.getParent();
      if (parent && Node.isVariableDeclaration(parent)) {
        name = parent.getName();
      }

      codeUnits.push({
        filePath: sourceFile.getFilePath(),
        startLine: arrowFunc.getStartLineNumber(),
        endLine: arrowFunc.getEndLineNumber(),
        type: 'arrowFunction',
        name,
        fingerprint: this.generateFingerprint(bodyText),
        codeText: bodyText,
        size: this.countLines(bodyText),
      });
    }
  }

  /**
   * 生成代码指纹
   * @param code 代码文本
   * @returns 代码指纹
   */
  private generateFingerprint(code: string): string {
    // 移除空白字符和注释以标准化代码
    const normalizedCode = this.normalizeCode(code);
    // 使用SHA1生成指纹
    return createHash('sha1').update(normalizedCode).digest('hex');
  }

  /**
   * 标准化代码文本（移除空白和注释）
   * @param code 原始代码文本
   * @returns 标准化后的代码文本
   */
  private normalizeCode(code: string): string {
    // 移除多行注释
    let normalized = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除单行注释
    normalized = normalized.replace(/\/\/.*$/gm, '');
    // 移除多余空白字符
    normalized = normalized.replace(/\s+/g, ' ');
    return normalized.trim();
  }

  /**
   * 计算代码文本的行数
   * @param code 代码文本
   * @returns 行数
   */
  private countLines(code: string): number {
    return code.split('\n').length;
  }

  /**
   * 在代码单元集合中找出重复代码
   * @param codeUnits 代码单元集合
   * @returns 重复代码映射和统计信息
   */
  private findDuplicates(codeUnits: IDuplicateInfo[]): {
    duplicateMap: Map<string, IDuplicateInfo[]>;
    totalDuplicates: number;
    duplicateLines: number;
  } {
    const fingerprintMap = new Map<string, IDuplicateInfo[]>();

    // 按指纹分组
    for (const unit of codeUnits) {
      const units = fingerprintMap.get(unit.fingerprint) || [];
      units.push(unit);
      fingerprintMap.set(unit.fingerprint, units);
    }

    // 过滤出重复的代码单元（至少有2个相同指纹）
    const duplicateMap = new Map<string, IDuplicateInfo[]>();
    let totalDuplicates = 0;
    let duplicateLines = 0;

    for (const [fingerprint, units] of fingerprintMap.entries()) {
      if (units.length >= 2) {
        duplicateMap.set(fingerprint, units);
        totalDuplicates += units.length;
        duplicateLines += units[0].size * (units.length - 1); // 只计算重复的行数
      }
    }

    return { duplicateMap, totalDuplicates, duplicateLines };
  }
}
