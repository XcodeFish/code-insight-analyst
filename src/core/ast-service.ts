import {
  Project,
  Node,
  SourceFile,
  SyntaxKind,
  ScriptTarget,
  ModuleKind,
  ModuleResolutionKind,
} from 'ts-morph';
import { Logger } from '../utils/logger';
import { IFileInfo } from './file-system-service';

/**
 * AST节点信息
 */
export interface IAstNodeInfo {
  kind: string;
  text: string;
  pos: number;
  end: number;
  children?: IAstNodeInfo[];
  // 可以添加更多属性
}

/**
 * AST服务
 * 处理TypeScript AST解析
 */
export class AstService {
  private logger: Logger;
  private project: Project;

  constructor() {
    this.logger = new Logger();
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
  }

  /**
   * 初始化项目
   * @param tsConfigFilePath tsconfig.json路径
   */
  async initializeProject(tsConfigFilePath?: string): Promise<void> {
    try {
      // 如果提供了tsconfig路径，则使用它
      if (tsConfigFilePath) {
        this.project = new Project({
          tsConfigFilePath,
        });
      } else {
        // 否则使用默认配置
        this.project = new Project({
          compilerOptions: {
            target: ScriptTarget.ES2018,
            module: ModuleKind.ESNext,
            moduleResolution: ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            skipLibCheck: true,
            allowJs: true,
          },
          skipFileDependencyResolution: true,
        });
      }

      this.logger.debug('AST解析服务初始化完成');
    } catch (error) {
      this.logger.error('初始化AST解析服务失败:', error);
      throw error;
    }
  }

  /**
   * 添加文件
   * @param filePaths 文件路径数组
   */
  async addFiles(files: IFileInfo[]): Promise<void> {
    try {
      const tsFiles = files.filter(
        (file) =>
          !file.isDirectory &&
          ['.ts', '.tsx', '.js', '.jsx'].includes(file.extension)
      );

      // 添加文件到项目
      for (const file of tsFiles) {
        this.project.addSourceFileAtPath(file.path);
      }

      this.logger.debug(`已添加 ${tsFiles.length} 个文件到AST解析器`);
    } catch (error) {
      this.logger.error('添加文件到AST解析器失败:', error);
      throw error;
    }
  }

  /**
   * 获取源文件
   * @param filePath 文件路径
   */
  getSourceFile(filePath: string): SourceFile | undefined {
    return this.project.getSourceFile(filePath);
  }

  /**
   * 获取所有源文件
   */
  getAllSourceFiles(): SourceFile[] {
    return this.project.getSourceFiles();
  }

  /**
   * 获取指定文件的AST
   * @param filePath 文件路径
   */
  async getFileAst(filePath: string): Promise<IAstNodeInfo | null> {
    try {
      const sourceFile = this.getSourceFile(filePath);
      if (!sourceFile) {
        this.logger.warn(`找不到源文件: ${filePath}`);
        return null;
      }

      // 转换AST节点为节点信息
      return this.convertNodeToInfo(sourceFile);
    } catch (error) {
      this.logger.error(`获取文件AST失败 ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 转换AST节点为节点信息
   */
  private convertNodeToInfo(node: Node): IAstNodeInfo {
    const children: IAstNodeInfo[] = [];

    node.forEachChild((child) => {
      children.push(this.convertNodeToInfo(child));
    });

    return {
      kind: SyntaxKind[node.getKind()],
      text: node.getText(),
      pos: node.getPos(),
      end: node.getEnd(),
      children: children.length > 0 ? children : undefined,
    };
  }
}
