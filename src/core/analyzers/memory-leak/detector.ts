import { SourceFile, Node, SyntaxKind } from 'ts-morph';
import {
  ResourceType,
  ResourceUsage,
  LeakWarning,
  LeakSeverity,
} from './types';

/**
 * 内存泄漏检测器类
 * 负责检测代码中的潜在内存泄漏问题
 */
export class MemoryLeakDetector {
  /**
   * 分析源文件中的潜在内存泄漏问题
   *
   * @param sourceFile - 待分析的源文件
   * @returns 内存泄漏警告列表
   */
  public analyzeFile(sourceFile: SourceFile): LeakWarning[] {
    const warnings: LeakWarning[] = [];

    // 合并不同类型的分析结果
    warnings.push(...this.analyzeResourceLifecycle(sourceFile));
    warnings.push(...this.detectClosureLeaks(sourceFile));
    warnings.push(...this.detectEventListenerLeaks(sourceFile));
    warnings.push(...this.detectTimerLeaks(sourceFile));

    return warnings;
  }

  /**
   * 分析资源的生命周期，检测未释放的资源
   *
   * @param sourceFile - 待分析的源文件
   * @returns 资源泄漏警告列表
   */
  private analyzeResourceLifecycle(sourceFile: SourceFile): LeakWarning[] {
    const warnings: LeakWarning[] = [];
    const resourceUsages = new Map<string, ResourceUsage>();

    // 寻找资源创建和释放的模式
    this.findResourceCreation(sourceFile, resourceUsages);
    this.findResourceRelease(sourceFile, resourceUsages);

    // 判断哪些资源没有对应的释放操作
    for (const [, usage] of resourceUsages.entries()) {
      if (usage.isCreated && !usage.isReleased) {
        warnings.push({
          type: 'resource-leak',
          message: `可能的资源泄漏: ${usage.resourceType} 在 ${usage.location.line}:${usage.location.column} 创建但未释放`,
          location: usage.location,
          severity: LeakSeverity.HIGH,
          resourceType: usage.resourceType,
          filePath: sourceFile.getFilePath(),
        });
      }
    }

    return warnings;
  }

  /**
   * 查找资源创建模式
   *
   * @param sourceFile - 待分析的源文件
   * @param resourceUsages - 资源使用情况映射
   */
  private findResourceCreation(
    sourceFile: SourceFile,
    resourceUsages: Map<string, ResourceUsage>
  ): void {
    // 查找文件系统创建
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

        // 检测文件系统资源创建
        if (Node.isPropertyAccessExpression(expression)) {
          const object = expression.getExpression().getText();
          const property = expression.getName();

          if (
            object === 'fs' &&
            (property === 'createReadStream' ||
              property === 'createWriteStream')
          ) {
            const args = node.getArguments();
            if (args.length > 0) {
              const filePath = args[0].getText();
              const resourceId = `${object}.${property}(${filePath})`;
              const position = node.getStart();
              const { line, column } =
                sourceFile.getLineAndColumnAtPos(position);

              resourceUsages.set(resourceId, {
                resourceId,
                resourceType: ResourceType.FILE_STREAM,
                isCreated: true,
                isReleased: false,
                location: { line, column },
                variableName: this.getAssignedVariable(node),
              });
            }
          }

          // 检测数据库连接创建
          if (
            (object.includes('sql') ||
              object.includes('db') ||
              object.includes('mongo')) &&
            (property === 'connect' || property === 'createConnection')
          ) {
            const resourceId = `${object}.${property}`;
            const position = node.getStart();
            const { line, column } = sourceFile.getLineAndColumnAtPos(position);

            resourceUsages.set(resourceId, {
              resourceId,
              resourceType: ResourceType.DATABASE_CONNECTION,
              isCreated: true,
              isReleased: false,
              location: { line, column },
              variableName: this.getAssignedVariable(node),
            });
          }
        }
      }
    });
  }

  /**
   * 查找资源释放模式
   *
   * @param sourceFile - 待分析的源文件
   * @param resourceUsages - 资源使用情况映射
   */
  private findResourceRelease(
    sourceFile: SourceFile,
    resourceUsages: Map<string, ResourceUsage>
  ): void {
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

        if (Node.isPropertyAccessExpression(expression)) {
          const object = expression.getExpression().getText();
          const property = expression.getName();

          // 检测资源释放方法
          if (
            property === 'close' ||
            property === 'end' ||
            property === 'destroy' ||
            property === 'disconnect' ||
            property === 'release'
          ) {
            // 查找与创建操作匹配的释放操作
            for (const [resourceId, usage] of resourceUsages.entries()) {
              if (usage.variableName && object.includes(usage.variableName)) {
                resourceUsages.set(resourceId, {
                  ...usage,
                  isReleased: true,
                });
              }
            }
          }
        }
      }
    });
  }

  /**
   * 获取变量赋值名称
   *
   * @param node - 节点
   * @returns 变量名称（如果存在）
   */
  private getAssignedVariable(node: Node): string | undefined {
    const parent = node.getParent();

    if (parent && Node.isVariableDeclaration(parent)) {
      return parent.getName();
    }

    if (parent && Node.isBinaryExpression(parent)) {
      const left = parent.getLeft();
      return left.getText();
    }

    return undefined;
  }

  /**
   * 检测闭包内的潜在内存泄漏
   *
   * @param sourceFile - 待分析的源文件
   * @returns 闭包泄漏警告列表
   */
  private detectClosureLeaks(sourceFile: SourceFile): LeakWarning[] {
    const warnings: LeakWarning[] = [];

    const checkFunction = (
      node: Node,
      isClass: boolean = false,
      className?: string
    ): void => {
      if (
        Node.isFunctionDeclaration(node) ||
        Node.isMethodDeclaration(node) ||
        Node.isArrowFunction(node) ||
        Node.isFunctionExpression(node)
      ) {
        // 查找使用外部作用域变量的闭包
        const closureRefs = this.findClosureReferences(node);
        if (closureRefs.length > 0) {
          // 检查是否在事件监听器或定时器设置中
          const isInEventHandler = this.isInEventListenerContext(node);
          const isInTimerCallback = this.isInTimerContext(node);

          if (isInEventHandler || isInTimerCallback) {
            const position = node.getStart();
            const { line, column } = sourceFile.getLineAndColumnAtPos(position);

            const containingFunction =
              node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
              node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);

            const containerName = containingFunction
              ? containingFunction.getName() || '未命名函数'
              : isClass
                ? `${className || 'Unknown'}类`
                : '匿名函数';

            warnings.push({
              type: 'closure-leak',
              message: `可能的闭包泄漏: 在${isInEventHandler ? '事件监听器' : '定时器'}中引用了外部作用域变量 [${closureRefs.join(', ')}]，可能导致内存泄漏`,
              location: { line, column },
              severity: LeakSeverity.MEDIUM,
              containerName,
              closureVars: closureRefs,
              filePath: sourceFile.getFilePath(),
            });
          }
        }
      }

      // 递归检查子节点
      node.forEachChild((child) => checkFunction(child, isClass, className));
    };

    // 检查类方法
    sourceFile.getClasses().forEach((classDecl) => {
      const className = classDecl.getName();
      classDecl.getMethods().forEach((method) => {
        checkFunction(method, true, className);
      });
    });

    // 检查全局函数
    sourceFile.getFunctions().forEach((func) => {
      checkFunction(func);
    });

    // 检查变量中的函数表达式和箭头函数
    sourceFile.forEachDescendant((node) => {
      if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
        checkFunction(node);
      }
    });

    return warnings;
  }

  /**
   * 查找函数中引用的外部作用域变量
   *
   * @param node - 函数节点
   * @returns 引用的外部变量名列表
   */
  private findClosureReferences(node: Node): string[] {
    const references = new Set<string>();
    const localVars = new Set<string>();

    // 收集本地变量
    node.forEachDescendant((child) => {
      if (Node.isVariableDeclaration(child)) {
        const name = child.getName();
        if (name) {
          localVars.add(name);
        }
      } else if (Node.isParameterDeclaration(child)) {
        const name = child.getName();
        if (name) {
          localVars.add(name);
        }
      }
    });

    // 查找标识符引用
    node.forEachDescendant((child) => {
      if (Node.isIdentifier(child)) {
        const name = child.getText();
        // 排除局部变量和内置对象
        if (
          !localVars.has(name) &&
          !['console', 'window', 'document', 'this', 'self', 'global'].includes(
            name
          )
        ) {
          references.add(name);
        }
      }
    });

    return Array.from(references);
  }

  /**
   * 检测事件监听器泄漏
   *
   * @param sourceFile - 待分析的源文件
   * @returns 事件监听器泄漏警告列表
   */
  private detectEventListenerLeaks(sourceFile: SourceFile): LeakWarning[] {
    const warnings: LeakWarning[] = [];
    const eventListeners = new Map<
      string,
      {
        added: number;
        removed: number;
        locations: { line: number; column: number }[];
      }
    >();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

        if (Node.isPropertyAccessExpression(expression)) {
          const object = expression.getExpression().getText();
          const property = expression.getName();

          // 检测添加事件监听器
          if (
            property === 'addEventListener' ||
            property === 'on' ||
            property === 'addListener'
          ) {
            const args = node.getArguments();
            if (args.length > 0) {
              const eventType = args[0].getText();
              const listenerKey = `${object}.${eventType}`;
              const position = node.getStart();
              const { line, column } =
                sourceFile.getLineAndColumnAtPos(position);

              const existingEntry = eventListeners.get(listenerKey) || {
                added: 0,
                removed: 0,
                locations: [],
              };
              existingEntry.added += 1;
              existingEntry.locations.push({ line, column });
              eventListeners.set(listenerKey, existingEntry);
            }
          }

          // 检测移除事件监听器
          if (
            property === 'removeEventListener' ||
            property === 'off' ||
            property === 'removeListener'
          ) {
            const args = node.getArguments();
            if (args.length > 0) {
              const eventType = args[0].getText();
              const listenerKey = `${object}.${eventType}`;

              const existingEntry = eventListeners.get(listenerKey) || {
                added: 0,
                removed: 0,
                locations: [],
              };
              existingEntry.removed += 1;
              eventListeners.set(listenerKey, existingEntry);
            }
          }
        }
      }
    });

    // 检查未移除的事件监听器
    for (const [listenerKey, info] of eventListeners.entries()) {
      if (info.added > info.removed) {
        for (const location of info.locations) {
          warnings.push({
            type: 'event-listener-leak',
            message: `可能的事件监听器泄漏: ${listenerKey} 添加了 ${info.added} 次但只移除了 ${info.removed} 次`,
            location,
            severity: LeakSeverity.HIGH,
            filePath: sourceFile.getFilePath(),
          });
        }
      }
    }

    return warnings;
  }

  /**
   * 检测定时器泄漏
   *
   * @param sourceFile - 待分析的源文件
   * @returns 定时器泄漏警告列表
   */
  private detectTimerLeaks(sourceFile: SourceFile): LeakWarning[] {
    const warnings: LeakWarning[] = [];
    const timers = new Map<
      string,
      {
        created: boolean;
        cleared: boolean;
        location: { line: number; column: number };
        varName: string;
      }
    >();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();

        if (Node.isIdentifier(expression)) {
          const functionName = expression.getText();

          // 检测定时器创建
          if (functionName === 'setTimeout' || functionName === 'setInterval') {
            const position = node.getStart();
            const { line, column } = sourceFile.getLineAndColumnAtPos(position);

            // 尝试获取变量名
            const variableName =
              this.getAssignedVariable(node) ||
              `anonymous_${functionName}_${line}`;
            timers.set(variableName, {
              created: true,
              cleared: false,
              location: { line, column },
              varName: variableName,
            });
          }

          // 检测定时器清除
          if (
            functionName === 'clearTimeout' ||
            functionName === 'clearInterval'
          ) {
            const args = node.getArguments();
            if (args.length > 0) {
              const timerVar = args[0].getText();

              // 匹配变量名
              if (timers.has(timerVar)) {
                const timerInfo = timers.get(timerVar)!;
                timers.set(timerVar, {
                  ...timerInfo,
                  cleared: true,
                });
              }
            }
          }
        }
      }
    });

    // 检查未清除的定时器
    for (const [timerVar, info] of timers.entries()) {
      if (info.created && !info.cleared) {
        const locationInfo = info.location;
        warnings.push({
          type: 'timer-leak',
          message: `可能的定时器泄漏: ${timerVar} 在 ${locationInfo.line}:${locationInfo.column} 创建但未清除`,
          location: locationInfo,
          severity: LeakSeverity.MEDIUM,
          filePath: sourceFile.getFilePath(),
        });
      }
    }

    return warnings;
  }

  /**
   * 判断节点是否在事件监听器上下文中
   *
   * @param node - 节点
   * @returns 是否在事件监听器上下文中
   */
  private isInEventListenerContext(node: Node): boolean {
    let current: Node | undefined = node;

    while (current) {
      if (Node.isCallExpression(current)) {
        const expression = current.getExpression();
        if (Node.isPropertyAccessExpression(expression)) {
          const property = expression.getName();
          if (
            property === 'addEventListener' ||
            property === 'on' ||
            property === 'addListener'
          ) {
            return true;
          }
        }
      }
      current = current.getParent();
    }

    return false;
  }

  /**
   * 判断节点是否在定时器上下文中
   *
   * @param node - 节点
   * @returns 是否在定时器上下文中
   */
  private isInTimerContext(node: Node): boolean {
    let current: Node | undefined = node;

    while (current) {
      if (Node.isCallExpression(current)) {
        const expression = current.getExpression();
        if (Node.isIdentifier(expression)) {
          const name = expression.getText();
          if (name === 'setTimeout' || name === 'setInterval') {
            return true;
          }
        }
      }
      current = current.getParent();
    }

    return false;
  }
}
