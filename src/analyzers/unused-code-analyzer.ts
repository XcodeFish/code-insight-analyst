import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { IAnalyzer } from '../interfaces/analyzer';
import { AnalysisResult } from '../types/analysis-result';

/**
 * 表示未使用代码元素
 */
export interface IUnusedCodeItem {
  filePath: string;
  line: number;
  column: number;
  type: string;
  name: string;
  scope?: string;
}

/**
 * 未使用代码分析结果
 */
export interface IUnusedCodeAnalysisResult extends AnalysisResult {
  unusedImports: IUnusedCodeItem[];
  unusedVariables: IUnusedCodeItem[];
  unusedFunctions: IUnusedCodeItem[];
  unusedClasses: IUnusedCodeItem[];
  unusedInterfaces: IUnusedCodeItem[];
  unusedTypes: IUnusedCodeItem[];
  totalUnused: number;
  affectedFiles: string[];
}

/**
 * 未使用代码分析器实现
 */
export class UnusedCodeAnalyzer
  implements IAnalyzer<IUnusedCodeAnalysisResult>
{
  private project: Project;
  private ignorePatterns: RegExp[];

  /**
   * 创建未使用代码分析器实例
   * @param projectPath 项目根路径
   * @param ignorePatterns 忽略模式（正则表达式）
   */
  constructor(projectPath: string, ignorePatterns: string[] = []) {
    this.project = new Project({
      tsConfigFilePath: `${projectPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    });
    this.project.addSourceFilesAtPaths([
      `${projectPath}/src/**/*.ts`,
      `${projectPath}/src/**/*.tsx`,
    ]);

    // 转换忽略模式字符串为正则表达式
    this.ignorePatterns = ignorePatterns.map((pattern) => new RegExp(pattern));
  }

  /**
   * 执行未使用代码分析
   * @returns 分析结果
   */
  async analyze(): Promise<IUnusedCodeAnalysisResult> {
    const startTime = Date.now();
    console.info('开始检测未使用代码...');

    // 初始化结果对象
    const result: IUnusedCodeAnalysisResult = {
      unusedImports: [],
      unusedVariables: [],
      unusedFunctions: [],
      unusedClasses: [],
      unusedInterfaces: [],
      unusedTypes: [],
      totalUnused: 0,
      affectedFiles: [],
      duration: 0,
    };

    // 分析每个源文件
    for (const sourceFile of this.project.getSourceFiles()) {
      // 找未使用的导入
      this.findUnusedImports(sourceFile, result);

      // 找未使用的变量
      this.findUnusedVariables(sourceFile, result);

      // 找未使用的函数
      this.findUnusedFunctions(sourceFile, result);

      // 找未使用的类
      this.findUnusedClasses(sourceFile, result);

      // 找未使用的接口和类型
      this.findUnusedTypes(sourceFile, result);
    }

    // 计算总数和影响的文件
    result.totalUnused =
      result.unusedImports.length +
      result.unusedVariables.length +
      result.unusedFunctions.length +
      result.unusedClasses.length +
      result.unusedInterfaces.length +
      result.unusedTypes.length;

    const affectedFilesSet = new Set<string>();
    [
      ...result.unusedImports,
      ...result.unusedVariables,
      ...result.unusedFunctions,
      ...result.unusedClasses,
      ...result.unusedInterfaces,
      ...result.unusedTypes,
    ].forEach((item) => affectedFilesSet.add(item.filePath));

    result.affectedFiles = Array.from(affectedFilesSet);

    // 记录分析耗时
    const endTime = Date.now();
    result.duration = endTime - startTime;

    return result;
  }

  /**
   * 检查是否应该忽略某个标识符
   * @param name 标识符名称
   * @returns 是否忽略
   */
  private shouldIgnore(name: string): boolean {
    // 忽略以 _ 开头的标识符
    if (name.startsWith('_')) {
      return true;
    }

    // 检查是否匹配任一忽略模式
    return this.ignorePatterns.some((pattern) => pattern.test(name));
  }

  /**
   * 查找指定名称在源文件中的所有引用节点
   * @param sourceFile 源文件
   * @param name 要查找的名称
   * @returns 引用节点数组
   */
  private findAllReferences(sourceFile: SourceFile, name: string): Node[] {
    // 找出所有标识符节点
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

    // 过滤出匹配的标识符
    return identifiers.filter((identifier) => identifier.getText() === name);
  }

  /**
   * 查找未使用的导入
   * @param sourceFile 源文件
   * @param result 分析结果
   */
  private findUnusedImports(
    sourceFile: SourceFile,
    result: IUnusedCodeAnalysisResult
  ): void {
    const importDeclarations = sourceFile.getImportDeclarations();

    for (const importDecl of importDeclarations) {
      const namedImports = importDecl.getNamedImports();

      for (const namedImport of namedImports) {
        const name = namedImport.getName();

        // 忽略特定的标识符
        if (this.shouldIgnore(name)) {
          continue;
        }

        // 创建引用查找条件
        const aliasName = namedImport.getAliasNode()?.getText() || name;

        // 查找除导入声明外的所有引用
        const refs = this.findAllReferences(sourceFile, aliasName).filter(
          (ref: Node) => {
            // 排除导入语句中的引用
            const parentImport = ref.getFirstAncestorByKind(
              SyntaxKind.ImportDeclaration
            );
            return !parentImport || parentImport !== importDecl;
          }
        );

        // 无引用则为未使用导入
        if (refs.length === 0) {
          const pos = namedImport.getStartLineNumber();
          const col = namedImport.getStart() - namedImport.getStartLinePos();

          result.unusedImports.push({
            filePath: sourceFile.getFilePath(),
            line: pos,
            column: col,
            type: 'import',
            name: name,
          });
        }
      }
    }
  }

  /**
   * 查找未使用的变量
   * @param sourceFile 源文件
   * @param result 分析结果
   */
  private findUnusedVariables(
    sourceFile: SourceFile,
    result: IUnusedCodeAnalysisResult
  ): void {
    const variableDeclarations = sourceFile.getDescendantsOfKind(
      SyntaxKind.VariableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      const name = varDecl.getName();

      // 忽略特定的标识符
      if (this.shouldIgnore(name)) {
        continue;
      }

      // 导出的变量不视为未使用
      const parentStatement = varDecl.getFirstAncestorByKind(
        SyntaxKind.VariableStatement
      );
      if (parentStatement && parentStatement.isExported()) {
        continue;
      }

      // 查找除声明外的所有引用
      const identifier = varDecl.getNameNode();
      const refs = this.findAllReferences(sourceFile, name).filter(
        (ref: Node) => ref !== identifier
      );

      // 无引用则为未使用变量
      if (refs.length === 0) {
        // 获取变量定义的上下文范围
        const scopeFunction =
          varDecl.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
          varDecl.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);

        let scope = undefined;
        if (scopeFunction) {
          const funcName = scopeFunction.getKindName();
          scope = `${funcName}`;
        }

        result.unusedVariables.push({
          filePath: sourceFile.getFilePath(),
          line: varDecl.getStartLineNumber(),
          column: varDecl.getStart() - varDecl.getStartLinePos(),
          type: 'variable',
          name: name,
          scope,
        });
      }
    }
  }

  /**
   * 查找未使用的函数
   * @param sourceFile 源文件
   * @param result 分析结果
   */
  private findUnusedFunctions(
    sourceFile: SourceFile,
    result: IUnusedCodeAnalysisResult
  ): void {
    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const name = func.getName();

      // 忽略匿名函数和特定标识符
      if (!name || this.shouldIgnore(name)) {
        continue;
      }

      // 导出的函数不视为未使用
      if (func.isExported()) {
        continue;
      }

      // 测试函数一般不视为未使用
      if (
        name.startsWith('test') ||
        name.startsWith('it') ||
        name.startsWith('describe')
      ) {
        continue;
      }

      // 查找除声明外的所有引用
      const refs = this.findAllReferences(sourceFile, name).filter(
        (ref: Node) =>
          ref.getParent()?.getKind() !== SyntaxKind.FunctionDeclaration
      );

      // 无引用则为未使用函数
      if (refs.length === 0) {
        result.unusedFunctions.push({
          filePath: sourceFile.getFilePath(),
          line: func.getStartLineNumber(),
          column: func.getStart() - func.getStartLinePos(),
          type: 'function',
          name: name,
        });
      }
    }
  }

  /**
   * 查找未使用的类
   * @param sourceFile 源文件
   * @param result 分析结果
   */
  private findUnusedClasses(
    sourceFile: SourceFile,
    result: IUnusedCodeAnalysisResult
  ): void {
    const classes = sourceFile.getClasses();

    for (const cls of classes) {
      const name = cls.getName();

      // 忽略匿名类和特定标识符
      if (!name || this.shouldIgnore(name)) {
        continue;
      }

      // 导出的类不视为未使用
      if (cls.isExported()) {
        continue;
      }

      // 查找除声明外的所有引用
      const refs = this.findAllReferences(sourceFile, name).filter(
        (ref: Node) =>
          ref.getParent()?.getKind() !== SyntaxKind.ClassDeclaration
      );

      // 无引用则为未使用类
      if (refs.length === 0) {
        result.unusedClasses.push({
          filePath: sourceFile.getFilePath(),
          line: cls.getStartLineNumber(),
          column: cls.getStart() - cls.getStartLinePos(),
          type: 'class',
          name: name,
        });
      }
    }
  }

  /**
   * 查找未使用的接口和类型
   * @param sourceFile 源文件
   * @param result 分析结果
   */
  private findUnusedTypes(
    sourceFile: SourceFile,
    result: IUnusedCodeAnalysisResult
  ): void {
    // 查找接口
    const interfaces = sourceFile.getInterfaces();

    for (const iface of interfaces) {
      const name = iface.getName();

      // 忽略特定标识符
      if (this.shouldIgnore(name)) {
        continue;
      }

      // 导出的接口不视为未使用
      if (iface.isExported()) {
        continue;
      }

      // 查找除声明外的所有引用
      const refs = this.findAllReferences(sourceFile, name).filter(
        (ref: Node) =>
          ref.getParent()?.getKind() !== SyntaxKind.InterfaceDeclaration
      );

      // 无引用则为未使用接口
      if (refs.length === 0) {
        result.unusedInterfaces.push({
          filePath: sourceFile.getFilePath(),
          line: iface.getStartLineNumber(),
          column: iface.getStart() - iface.getStartLinePos(),
          type: 'interface',
          name: name,
        });
      }
    }

    // 查找类型别名
    const typeAliases = sourceFile.getTypeAliases();

    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();

      // 忽略特定标识符
      if (this.shouldIgnore(name)) {
        continue;
      }

      // 导出的类型别名不视为未使用
      if (typeAlias.isExported()) {
        continue;
      }

      // 查找除声明外的所有引用
      const refs = this.findAllReferences(sourceFile, name).filter(
        (ref: Node) =>
          ref.getParent()?.getKind() !== SyntaxKind.TypeAliasDeclaration
      );

      // 无引用则为未使用类型别名
      if (refs.length === 0) {
        result.unusedTypes.push({
          filePath: sourceFile.getFilePath(),
          line: typeAlias.getStartLineNumber(),
          column: typeAlias.getStart() - typeAlias.getStartLinePos(),
          type: 'type',
          name: name,
        });
      }
    }
  }
}
