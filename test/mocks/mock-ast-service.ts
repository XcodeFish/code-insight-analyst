/* global jest */
import { AstService } from '../../src/core/ast-service';

/**
 * 创建模拟的 AstService
 */
export function createMockAstService(): jest.Mocked<AstService> {
  const mockAstService = {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    project: {
      addSourceFileAtPath: jest.fn(),
      getSourceFile: jest.fn(),
      getSourceFiles: jest.fn().mockReturnValue([]),
    },
    initializeProject: jest.fn().mockResolvedValue(undefined),
    addFiles: jest.fn().mockResolvedValue(undefined),
    parseFile: jest.fn().mockResolvedValue({
      sourceFile: {
        getClasses: jest.fn().mockReturnValue([]),
        getFunctions: jest.fn().mockReturnValue([]),
        getInterfaces: jest.fn().mockReturnValue([]),
        getVariableDeclarations: jest.fn().mockReturnValue([]),
      },
    }),
    parseFiles: jest.fn().mockResolvedValue(new Map()),
    getSourceFile: jest.fn().mockReturnValue({
      getClasses: jest.fn().mockReturnValue([]),
      getFunctions: jest.fn().mockReturnValue([]),
      getInterfaces: jest.fn().mockReturnValue([]),
      getVariableDeclarations: jest.fn().mockReturnValue([]),
      forEachChild: jest.fn(),
      getKind: jest.fn().mockReturnValue(0),
      getText: jest.fn().mockReturnValue(''),
      getPos: jest.fn().mockReturnValue(0),
      getEnd: jest.fn().mockReturnValue(0),
    }),
    getAllSourceFiles: jest.fn().mockReturnValue([]),
    getFileAst: jest.fn().mockResolvedValue(null),
    addSourceFile: jest.fn(),
    removeSourceFile: jest.fn(),
    updateSourceFile: jest.fn(),
    getProject: jest.fn().mockReturnValue({
      getSourceFiles: jest.fn().mockReturnValue([]),
    }),
    reset: jest.fn(),
  } as unknown as jest.Mocked<AstService>;

  return mockAstService;
}
