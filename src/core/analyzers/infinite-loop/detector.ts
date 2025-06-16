import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import {
  LoopType,
  LoopRiskLevel,
  LoopIssueType,
  PotentialInfiniteLoop,
  LoopInfo,
  ForLoopInfo,
  WhileLoopInfo,
  DoWhileLoopInfo,
  ForOfInLoopInfo,
  RecursiveCallInfo,
} from './types';

/**
 * 死循环检测器类
 * 负责检测代码中可能存在的无限循环问题
 */
export class InfiniteLoopDetector {
  /**
   * 分析源文件中的潜在无限循环问题
   *
   * @param sourceFile - 待分析的源文件
   * @returns 潜在无限循环问题列表
   */
  public analyzeFile(sourceFile: SourceFile): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 检测各种类型的循环
    issues.push(...this.detectForLoops(sourceFile));
    issues.push(...this.detectWhileLoops(sourceFile));
    issues.push(...this.detectDoWhileLoops(sourceFile));
    issues.push(...this.detectForOfInLoops(sourceFile));
    issues.push(...this.detectRecursiveCalls(sourceFile));

    return issues;
  }

  /**
   * 检测for循环中的潜在无限循环
   *
   * @param sourceFile - 源文件
   * @returns 潜在问题列表
   */
  private detectForLoops(sourceFile: SourceFile): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 获取所有for循环语句
    const forStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.ForStatement
    );

    for (const forStmt of forStatements) {
      const startPosition = forStmt.getStart();
      const endPosition = forStmt.getEnd();

      // 获取循环信息
      const loopInfo: ForLoopInfo = {
        type: LoopType.FOR,
        position: {
          startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
          startColumn: sourceFile.getLineAndColumnAtPos(startPosition).column,
          endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
          endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
          filePath: sourceFile.getFilePath(),
        },
        risk: LoopRiskLevel.LOW,
        initExpression: forStmt.getInitializer()?.getText(),
        condition: forStmt.getCondition()?.getText(),
        updateExpression: forStmt.getIncrementor()?.getText(),
        bodyHasBreak: this.hasBreakStatement(forStmt.getStatement()),
        bodyHasReturn: this.hasReturnStatement(forStmt.getStatement()),
      };

      // 检查缺少条件
      if (!loopInfo.condition) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_EXIT_CONDITION,
            '循环缺少退出条件',
            LoopRiskLevel.HIGH,
            '添加明确的循环终止条件'
          )
        );
        continue;
      }

      // 检查循环变量更新
      if (!loopInfo.updateExpression) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_CONDITION_CHANGE,
            '循环没有更新表达式，条件变量可能不变化',
            LoopRiskLevel.HIGH,
            '添加循环变量更新表达式'
          )
        );
        continue;
      }

      // 提取条件中使用的变量名
      const conditionVars = this.extractIdentifiers(forStmt.getCondition());

      // 提取更新表达式中使用的变量名
      const updateVars = this.extractIdentifiers(forStmt.getIncrementor());

      // 检查条件变量是否在更新表达式中被修改
      const commonVars = conditionVars.filter((v) => updateVars.includes(v));
      if (
        commonVars.length === 0 &&
        !loopInfo.bodyHasBreak &&
        !loopInfo.bodyHasReturn
      ) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_CONDITION_CHANGE,
            '循环条件变量未在更新表达式中修改',
            LoopRiskLevel.HIGH,
            '确保循环条件中的变量在每次迭代中被更新'
          )
        );
      }

      // 检查更新方向和条件
      if (
        loopInfo.condition &&
        loopInfo.updateExpression &&
        commonVars.length > 0
      ) {
        const condition = loopInfo.condition;
        const update = loopInfo.updateExpression;

        // 检查更新方向与条件的匹配性
        for (const varName of commonVars) {
          const increasesInUpdate = this.variableIncreasesInExpression(
            varName,
            update
          );
          const decreasesInUpdate = this.variableDecreasesInExpression(
            varName,
            update
          );

          if (increasesInUpdate !== null && decreasesInUpdate === null) {
            // 变量在增加，检查条件是否可能导致无限循环
            if (
              condition.includes(`${varName} <`) ||
              condition.includes(`${varName}<=`)
            ) {
              // 正常情况：变量增加并且条件是 < 或 <=
            } else if (
              condition.includes(`${varName} >`) ||
              condition.includes(`${varName}>=`)
            ) {
              issues.push(
                this.createInfiniteLoopIssue(
                  loopInfo,
                  LoopIssueType.WRONG_CONDITION_DIRECTION,
                  `变量 ${varName} 在更新表达式中递增，但条件检查的方向相反`,
                  LoopRiskLevel.HIGH,
                  '更改条件方向或更新表达式方向'
                )
              );
            }
          } else if (decreasesInUpdate !== null && increasesInUpdate === null) {
            // 变量在减少，检查条件是否可能导致无限循环
            if (
              condition.includes(`${varName} >`) ||
              condition.includes(`${varName}>=`)
            ) {
              // 正常情况：变量减少并且条件是 > 或 >=
            } else if (
              condition.includes(`${varName} <`) ||
              condition.includes(`${varName}<=`)
            ) {
              issues.push(
                this.createInfiniteLoopIssue(
                  loopInfo,
                  LoopIssueType.WRONG_CONDITION_DIRECTION,
                  `变量 ${varName} 在更新表达式中递减，但条件检查的方向相反`,
                  LoopRiskLevel.HIGH,
                  '更改条件方向或更新表达式方向'
                )
              );
            }
          }
        }
      }

      // 检查循环体是否过于复杂
      if (this.isLoopBodyComplex(forStmt.getStatement())) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.COMPLEX_CONDITION,
            '循环体复杂度高，可能包含影响循环终止的逻辑',
            LoopRiskLevel.MEDIUM,
            '考虑简化循环体或添加额外的退出条件'
          )
        );
      }

      // 检查是否存在嵌套循环
      if (this.hasNestedLoop(forStmt.getStatement())) {
        // 嵌套循环本身不是问题，但提高风险等级
        loopInfo.risk = LoopRiskLevel.MEDIUM;
      }
    }

    return issues;
  }

  /**
   * 提取表达式中的标识符（变量名）
   *
   * @param node - 节点
   * @returns 标识符列表
   */
  private extractIdentifiers(node?: Node): string[] {
    if (!node) return [];

    const identifiers: string[] = [];
    node.forEachDescendant((descendant) => {
      if (Node.isIdentifier(descendant)) {
        identifiers.push(descendant.getText());
      }
    });

    return identifiers;
  }

  /**
   * 检查变量在表达式中是否增加
   *
   * @param varName - 变量名
   * @param expression - 表达式文本
   * @returns 是否增加
   */
  private variableIncreasesInExpression(
    varName: string,
    expression: string
  ): boolean | null {
    // 检查常见的递增模式
    if (expression.includes(`${varName}++`)) return true;
    if (expression.includes(`++${varName}`)) return true;
    if (expression.includes(`${varName} += `)) return true;
    if (expression.includes(`${varName} = ${varName} + `)) return true;

    // 不确定
    return null;
  }

  /**
   * 检查变量在表达式中是否减少
   *
   * @param varName - 变量名
   * @param expression - 表达式文本
   * @returns 是否减少
   */
  private variableDecreasesInExpression(
    varName: string,
    expression: string
  ): boolean | null {
    // 检查常见的递减模式
    if (expression.includes(`${varName}--`)) return true;
    if (expression.includes(`--${varName}`)) return true;
    if (expression.includes(`${varName} -= `)) return true;
    if (expression.includes(`${varName} = ${varName} - `)) return true;

    // 不确定
    return null;
  }

  /**
   * 检查节点中是否包含break语句
   *
   * @param node - 节点
   * @returns 是否包含break语句
   */
  private hasBreakStatement(node: Node): boolean {
    let hasBreak = false;
    node.forEachDescendant((descendant) => {
      if (Node.isBreakStatement(descendant)) {
        hasBreak = true;
      }
    });
    return hasBreak;
  }

  /**
   * 检查节点中是否包含return语句
   *
   * @param node - 节点
   * @returns 是否包含return语句
   */
  private hasReturnStatement(node: Node): boolean {
    let hasReturn = false;
    node.forEachDescendant((descendant) => {
      if (Node.isReturnStatement(descendant)) {
        hasReturn = true;
      }
    });
    return hasReturn;
  }

  /**
   * 检查节点中是否包含嵌套循环
   *
   * @param node - 节点
   * @returns 是否包含嵌套循环
   */
  private hasNestedLoop(node: Node): boolean {
    let hasNested = false;
    node.forEachDescendant((descendant) => {
      if (
        Node.isForStatement(descendant) ||
        Node.isWhileStatement(descendant) ||
        Node.isDoStatement(descendant) ||
        Node.isForOfStatement(descendant) ||
        Node.isForInStatement(descendant)
      ) {
        hasNested = true;
      }
    });
    return hasNested;
  }

  /**
   * 检查循环体是否复杂
   *
   * @param node - 节点
   * @returns 是否复杂
   */
  private isLoopBodyComplex(node: Node): boolean {
    let nodeCount = 0;
    let hasConditional = false;

    node.forEachDescendant(() => {
      nodeCount++;

      // 超过一定数量的节点认为是复杂的
      if (nodeCount > 30) {
        return;
      }
    });

    // 检查是否有条件语句
    node.forEachDescendant((descendant) => {
      if (
        Node.isIfStatement(descendant) ||
        Node.isConditionalExpression(descendant)
      ) {
        hasConditional = true;
      }
    });

    return nodeCount > 30 || hasConditional;
  }

  /**
   * 创建无限循环问题对象
   *
   * @param loopInfo - 循环信息
   * @param issueType - 问题类型
   * @param message - 问题描述
   * @param risk - 风险等级
   * @param suggestion - 建议
   * @returns 潜在问题对象
   */
  private createInfiniteLoopIssue(
    loopInfo: LoopInfo,
    issueType: LoopIssueType,
    message: string,
    risk: LoopRiskLevel,
    suggestion: string
  ): PotentialInfiniteLoop {
    try {
      // 获取代码片段
      const filePath = loopInfo.position.filePath;
      const sourceFile = new Project().addSourceFileAtPath(filePath);
      const sourceText = sourceFile.getFullText();

      // 创建一个简单的方式来提取代码片段
      const lines = sourceText.split('\n');
      const startLine = Math.max(0, loopInfo.position.startLine - 1); // 转换为0-based索引
      const endLine = Math.min(lines.length - 1, loopInfo.position.endLine - 1);

      // 提取相关代码行
      let code = '';
      if (startLine <= endLine && startLine >= 0 && endLine < lines.length) {
        code = lines.slice(startLine, endLine + 1).join('\n');
      }

      return {
        loopInfo,
        issueType,
        message,
        risk,
        code: code || '无法获取代码片段',
        suggestion,
      };
    } catch (error) {
      // 无法获取代码片段时的回退方案
      return {
        loopInfo,
        issueType,
        message,
        risk,
        code: '无法获取代码片段',
        suggestion,
      };
    }
  }

  /**
   * 提取在节点中被修改的变量名
   *
   * @param node - 节点
   * @returns 被修改的变量名列表
   */
  private extractModifiedVarsInBody(node: Node): string[] {
    const modifiedVars = new Set<string>();

    node.forEachDescendant((descendant) => {
      if (Node.isExpressionStatement(descendant)) {
        const expressionText = descendant.getExpression().getText();

        // 使用正则表达式识别变量修改模式
        // 匹配 x++, ++x, x--, --x
        const incrementPattern =
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\+\+|\+\+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const decrementPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)--|--(.*)/g;

        // 匹配赋值: x = y, x += y, x -= y 等
        const assignmentPattern =
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|\+=|-=|\*=|\/=)/g;

        // 提取自增/自减变量
        let match;
        while ((match = incrementPattern.exec(expressionText)) !== null) {
          const varName = match[1] || match[2];
          if (varName) modifiedVars.add(varName);
        }

        while ((match = decrementPattern.exec(expressionText)) !== null) {
          const varName = match[1] || match[2];
          if (varName) modifiedVars.add(varName);
        }

        // 提取赋值操作的变量
        while ((match = assignmentPattern.exec(expressionText)) !== null) {
          if (match[1]) modifiedVars.add(match[1]);
        }
      }
    });

    return Array.from(modifiedVars);
  }

  /**
   * 检测while循环中的潜在无限循环
   *
   * @param sourceFile - 源文件
   * @returns 潜在问题列表
   */
  private detectWhileLoops(sourceFile: SourceFile): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 获取所有while循环语句
    const whileStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.WhileStatement
    );

    for (const whileStmt of whileStatements) {
      const startPosition = whileStmt.getStart();
      const endPosition = whileStmt.getEnd();
      const conditionText = whileStmt.getExpression().getText();
      const conditionVars = this.extractIdentifiers(whileStmt.getExpression());
      const statement = whileStmt.getStatement();
      const bodyHasBreak = this.hasBreakStatement(statement);
      const bodyHasReturn = this.hasReturnStatement(statement);

      // 获取循环信息
      const loopInfo: WhileLoopInfo = {
        type: LoopType.WHILE,
        position: {
          startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
          startColumn: sourceFile.getLineAndColumnAtPos(startPosition).column,
          endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
          endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
          filePath: sourceFile.getFilePath(),
        },
        risk: LoopRiskLevel.LOW,
        condition: conditionText,
        conditionVars,
        bodyUpdatesConditionVars: false,
        bodyHasBreak,
        bodyHasReturn,
      };

      // 检查常见的无限循环模式
      const condition = loopInfo.condition;

      // 检查是否为true或1等常量条件
      if (
        condition === 'true' ||
        condition === '1' ||
        condition.trim() === '!0'
      ) {
        if (!loopInfo.bodyHasBreak && !loopInfo.bodyHasReturn) {
          issues.push(
            this.createInfiniteLoopIssue(
              loopInfo,
              LoopIssueType.NO_EXIT_CONDITION,
              '循环条件为常量true，缺少退出循环的方式',
              LoopRiskLevel.HIGH,
              '添加break或return语句以确保循环能够终止'
            )
          );
        }
      }

      // 检查条件变量是否在循环体中更新
      const bodyVars = this.extractModifiedVarsInBody(statement);

      // 更新条件变量是否被修改的标记
      loopInfo.bodyUpdatesConditionVars = conditionVars.some((v) =>
        bodyVars.includes(v)
      );

      // 检查条件变量是否有更新
      if (
        conditionVars.length > 0 &&
        !loopInfo.bodyUpdatesConditionVars &&
        !loopInfo.bodyHasBreak &&
        !loopInfo.bodyHasReturn
      ) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_CONDITION_CHANGE,
            '循环条件变量在循环体内未被修改',
            LoopRiskLevel.HIGH,
            '在循环体内更新条件变量的值，或添加退出条件'
          )
        );
      }

      // 检查循环体是否过于复杂
      if (this.isLoopBodyComplex(statement)) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.COMPLEX_CONDITION,
            '循环体复杂度高，可能包含影响循环终止的逻辑',
            LoopRiskLevel.MEDIUM,
            '考虑简化循环体或添加额外的退出条件'
          )
        );
      }
    }

    return issues;
  }

  /**
   * 检测do-while循环中的潜在无限循环
   *
   * @param sourceFile - 源文件
   * @returns 潜在问题列表
   */
  private detectDoWhileLoops(sourceFile: SourceFile): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 获取所有do-while循环语句
    const doWhileStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.DoStatement
    );

    for (const doWhileStmt of doWhileStatements) {
      const startPosition = doWhileStmt.getStart();
      const endPosition = doWhileStmt.getEnd();
      const conditionText = doWhileStmt.getExpression().getText();
      const conditionVars = this.extractIdentifiers(
        doWhileStmt.getExpression()
      );
      const statement = doWhileStmt.getStatement();
      const bodyHasBreak = this.hasBreakStatement(statement);
      const bodyHasReturn = this.hasReturnStatement(statement);

      // 获取循环信息
      const loopInfo: DoWhileLoopInfo = {
        type: LoopType.DO_WHILE,
        position: {
          startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
          startColumn: sourceFile.getLineAndColumnAtPos(startPosition).column,
          endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
          endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
          filePath: sourceFile.getFilePath(),
        },
        risk: LoopRiskLevel.LOW,
        condition: conditionText,
        conditionVars,
        bodyUpdatesConditionVars: false,
        bodyHasBreak,
        bodyHasReturn,
      };

      // 检查常见的无限循环模式
      const condition = loopInfo.condition;

      // 检查是否为true或1等常量条件
      if (
        condition === 'true' ||
        condition === '1' ||
        condition.trim() === '!0'
      ) {
        if (!loopInfo.bodyHasBreak && !loopInfo.bodyHasReturn) {
          issues.push(
            this.createInfiniteLoopIssue(
              loopInfo,
              LoopIssueType.NO_EXIT_CONDITION,
              'do-while循环条件为常量true，缺少退出循环的方式',
              LoopRiskLevel.HIGH,
              '添加break或return语句以确保循环能够终止'
            )
          );
        }
      }

      // 检查条件变量是否在循环体中更新
      const bodyVars = this.extractModifiedVarsInBody(statement);

      // 更新条件变量是否被修改的标记
      loopInfo.bodyUpdatesConditionVars = conditionVars.some((v) =>
        bodyVars.includes(v)
      );

      // 检查条件变量是否有更新
      if (
        conditionVars.length > 0 &&
        !loopInfo.bodyUpdatesConditionVars &&
        !loopInfo.bodyHasBreak &&
        !loopInfo.bodyHasReturn
      ) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_CONDITION_CHANGE,
            '循环条件变量在循环体内未被修改',
            LoopRiskLevel.HIGH,
            '在循环体内更新条件变量的值，或添加退出条件'
          )
        );
      }

      // 检查循环体是否过于复杂
      if (this.isLoopBodyComplex(statement)) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.COMPLEX_CONDITION,
            '循环体复杂度高，可能包含影响循环终止的逻辑',
            LoopRiskLevel.MEDIUM,
            '考虑简化循环体或添加额外的退出条件'
          )
        );
      }
    }

    return issues;
  }

  /**
   * 检测for-of和for-in循环中的潜在无限循环
   *
   * @param sourceFile - 源文件
   * @returns 潜在问题列表
   */
  private detectForOfInLoops(sourceFile: SourceFile): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 检查for-of循环
    const forOfStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.ForOfStatement
    );

    for (const forOfStmt of forOfStatements) {
      const startPosition = forOfStmt.getStart();
      const endPosition = forOfStmt.getEnd();
      const statement = forOfStmt.getStatement();
      const bodyHasBreak = this.hasBreakStatement(statement);
      const bodyHasReturn = this.hasReturnStatement(statement);

      // 检查迭代的对象是否可能是无限的
      const expression = forOfStmt.getExpression().getText();

      // 获取循环信息
      const loopInfo: ForOfInLoopInfo = {
        type: LoopType.FOR_OF,
        position: {
          startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
          startColumn: sourceFile.getLineAndColumnAtPos(startPosition).column,
          endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
          endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
          filePath: sourceFile.getFilePath(),
        },
        risk: LoopRiskLevel.LOW,
        iterator: forOfStmt.getInitializer().getText(),
        iterable: expression,
        bodyHasBreak,
        bodyHasReturn,
      };

      // 识别一些可能无限的迭代器模式
      if (
        expression.includes('generateInfinite') ||
        expression.includes('infinite') ||
        expression.includes('endless')
      ) {
        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.NO_EXIT_CONDITION,
            `for-of循环使用了可能无限的迭代器: ${expression}`,
            LoopRiskLevel.MEDIUM,
            '确保迭代器有明确的终止条件或在循环中添加退出逻辑'
          )
        );
      }
    }

    // 检查for-in循环
    const forInStatements = sourceFile.getDescendantsOfKind(
      SyntaxKind.ForInStatement
    );

    // for-in循环通常不会无限，因为它遍历对象的可枚举属性，
    // 但如果对象在循环中不断添加属性，则可能出现问题
    for (const forInStmt of forInStatements) {
      const startPosition = forInStmt.getStart();
      const endPosition = forInStmt.getEnd();
      const statement = forInStmt.getStatement();

      // 检查循环体是否修改了被迭代的对象
      const expression = forInStmt.getExpression().getText();
      const bodyText = statement.getText();

      // 检查是否在循环体中修改迭代的对象
      if (
        bodyText.includes(`${expression}.`) &&
        (bodyText.includes('=') || bodyText.includes('delete'))
      ) {
        const loopInfo: ForOfInLoopInfo = {
          type: LoopType.FOR_IN,
          position: {
            startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
            startColumn: sourceFile.getLineAndColumnAtPos(startPosition).column,
            endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
            endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
            filePath: sourceFile.getFilePath(),
          },
          risk: LoopRiskLevel.MEDIUM,
          iterator: forInStmt.getInitializer().getText(),
          iterable: expression,
          bodyHasBreak: this.hasBreakStatement(statement),
          bodyHasReturn: this.hasReturnStatement(statement),
        };

        issues.push(
          this.createInfiniteLoopIssue(
            loopInfo,
            LoopIssueType.COMPLEX_CONDITION,
            `for-in循环中修改了正在迭代的对象 ${expression}`,
            LoopRiskLevel.MEDIUM,
            '避免在for-in循环中修改被迭代的对象，或使用Object.keys()与标准for循环'
          )
        );
      }
    }

    return issues;
  }

  /**
   * 检测递归调用中的潜在无限循环
   *
   * @param sourceFile - 源文件
   * @returns 潜在问题列表
   */
  private detectRecursiveCalls(
    sourceFile: SourceFile
  ): PotentialInfiniteLoop[] {
    const issues: PotentialInfiniteLoop[] = [];

    // 获取所有函数声明
    const functionDeclarations = sourceFile.getFunctions();

    for (const funcDecl of functionDeclarations) {
      const funcName = funcDecl.getName();
      if (!funcName) continue; // 跳过匿名函数

      // 检查函数体中是否有对自身的调用
      let hasRecursiveCall = false;
      let hasBaseCase = false;
      const parameterNames = funcDecl.getParameters().map((p) => p.getName());

      // 查找递归调用
      funcDecl.forEachDescendant((node) => {
        if (Node.isCallExpression(node)) {
          const expression = node.getExpression();
          if (
            Node.isIdentifier(expression) &&
            expression.getText() === funcName
          ) {
            hasRecursiveCall = true;

            // 检查是否有参数变化
            const callArgs = node.getArguments();
            // 简单检查参数是否有明显变化
            if (callArgs.length === parameterNames.length) {
              for (let i = 0; i < callArgs.length; i++) {
                const argText = callArgs[i].getText();
                if (
                  argText.includes(parameterNames[i] + ' - 1') ||
                  argText.includes(parameterNames[i] + ' + 1') ||
                  argText.includes(parameterNames[i] + '-1') ||
                  argText.includes(parameterNames[i] + '+1') ||
                  argText.includes(parameterNames[i] + '--') ||
                  argText.includes(parameterNames[i] + '++') ||
                  argText.includes('--' + parameterNames[i]) ||
                  argText.includes('++' + parameterNames[i]) ||
                  argText.includes(parameterNames[i] + '.slice') ||
                  argText.includes(parameterNames[i] + '.substring') ||
                  argText.includes(parameterNames[i] + '.substr')
                ) {
                  // 有参数变化，可能更安全
                }
              }
            }
          }
        }
      });

      // 如果存在递归调用，检查是否有基础情况
      if (hasRecursiveCall) {
        // 查找常见的终止条件模式
        funcDecl.forEachDescendant((node) => {
          if (Node.isIfStatement(node)) {
            const condition = node.getExpression().getText();

            // 检查几种常见的基本情况条件
            if (
              condition.includes(' === 0') ||
              condition.includes(' == 0') ||
              condition.includes(' <= 0') ||
              condition.includes(' < 1') ||
              condition.includes('.length === 0') ||
              condition.includes('.length == 0') ||
              condition.includes('isEmpty') ||
              condition.includes('!') ||
              condition.includes('null') ||
              condition.includes('undefined')
            ) {
              // 可能有基本情况检查
              hasBaseCase = true;
            }

            // 检查return语句
            const thenStatement = node.getThenStatement();
            if (
              thenStatement &&
              thenStatement.getText().includes('return') &&
              !thenStatement.getText().includes(funcName)
            ) {
              // 可能的终止条件
              hasBaseCase = true;
            }
          }
        });

        // 如果有递归调用但没有明确的终止条件
        if (!hasBaseCase) {
          const startPosition = funcDecl.getStart();
          const endPosition = funcDecl.getEnd();

          const loopInfo: RecursiveCallInfo = {
            type: LoopType.RECURSIVE,
            position: {
              startLine: sourceFile.getLineAndColumnAtPos(startPosition).line,
              startColumn:
                sourceFile.getLineAndColumnAtPos(startPosition).column,
              endLine: sourceFile.getLineAndColumnAtPos(endPosition).line,
              endColumn: sourceFile.getLineAndColumnAtPos(endPosition).column,
              filePath: sourceFile.getFilePath(),
            },
            risk: LoopRiskLevel.HIGH,
            functionName: funcName,
            hasBaseCase: false,
            parameterChanges: [],
          };

          issues.push(
            this.createInfiniteLoopIssue(
              loopInfo,
              LoopIssueType.RECURSIVE_NO_BASE_CASE,
              `递归函数 ${funcName} 可能缺少基本情况或终止条件`,
              LoopRiskLevel.HIGH,
              '添加基本情况检查，确保递归调用能够最终终止'
            )
          );
        }
      }
    }

    return issues;
  }
}
