import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import { AstService } from '../core/ast-service';
import { IAnalysisResult } from '../core/analysis-orchestrator';
import { Logger } from '../utils/logger';

/**
 * 覆盖率信息接口
 */
export interface ICoverageData {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    statements: {
      total: number;
      covered: number;
      skipped: number;
      pct: number;
    };
    functions: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
  files: Record<
    string,
    {
      lines: { total: number; covered: number; skipped: number; pct: number };
      statements: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
      };
      functions: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
      };
      branches: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
      };
    }
  >;
}

/**
 * 代码覆盖率分析器
 * 使用Istanbul/nyc分析代码覆盖率
 */
export class CoverageAnalyzer {
  private logger: Logger;
  private targetPath: string;
  private astService: AstService;

  constructor(targetPath: string, astService: AstService) {
    this.logger = new Logger();
    this.targetPath = targetPath;
    this.astService = astService;
  }

  /**
   * 分析代码覆盖率
   */
  async analyze(
    progressCallback?: (message: string) => void
  ): Promise<IAnalysisResult> {
    this.logger.debug('开始代码覆盖率分析');

    if (progressCallback) {
      progressCallback('检查项目测试配置...');
    }

    // 检查是否有测试脚本
    const hasTests = await this.checkTestFiles();
    if (!hasTests) {
      return {
        type: 'coverage',
        data: null,
        summary: {
          title: '代码覆盖率分析',
          description: '未检测到有效的测试文件，无法分析覆盖率',
          metrics: {
            status: 'error',
            message: '未找到测试文件',
          },
        },
      };
    }

    if (progressCallback) {
      progressCallback('运行测试并收集覆盖率数据...');
    }

    // 运行测试并收集覆盖率数据
    try {
      const coverageData = await this.runTestsWithCoverage(progressCallback);

      // 分析结果
      return {
        type: 'coverage',
        data: coverageData,
        summary: {
          title: '代码覆盖率分析',
          description: '分析完成',
          metrics: {
            lines: coverageData.total.lines.pct,
            statements: coverageData.total.statements.pct,
            functions: coverageData.total.functions.pct,
            branches: coverageData.total.branches.pct,
            status: 'success',
          },
        },
      };
    } catch (error) {
      this.logger.error('代码覆盖率分析失败:', error);

      return {
        type: 'coverage',
        data: null,
        summary: {
          title: '代码覆盖率分析',
          description: '分析过程中出错',
          metrics: {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  }

  /**
   * 检查是否有测试文件
   */
  private async checkTestFiles(): Promise<boolean> {
    try {
      // 检查常见的测试目录和文件
      const testPatterns = [
        'test',
        'tests',
        'spec',
        '__tests__',
        '**/*.test.js',
        '**/*.test.ts',
        '**/*.spec.js',
        '**/*.spec.ts',
      ];

      for (const pattern of testPatterns) {
        const fullPath = path.join(this.targetPath, pattern);
        if (fs.existsSync(fullPath)) {
          return true;
        }
      }

      // 检查package.json中是否有test脚本
      const pkgPath = path.join(this.targetPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        if (pkg.scripts && pkg.scripts.test) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('检查测试文件失败:', error);
      return false;
    }
  }

  /**
   * 运行测试并收集覆盖率数据
   */
  private async runTestsWithCoverage(
    progressCallback?: (message: string) => void
  ): Promise<ICoverageData> {
    return new Promise((resolve, reject) => {
      // 创建临时目录存放覆盖率数据
      const tempDir = path.join(this.targetPath, '.nyc_output');
      fs.ensureDirSync(tempDir);

      // nyc配置
      const nycConfig = {
        include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx'],
        exclude: [
          'test/**',
          'tests/**',
          '**/*.spec.*',
          '**/*.test.*',
          '**/node_modules/**',
        ],
        reporter: ['json', 'text-summary', 'html'],
        'report-dir': path.join(this.targetPath, 'coverage'),
      };

      // 将配置写入临时文件
      const nycrcPath = path.join(this.targetPath, '.nycrc.json');
      fs.writeJSONSync(nycrcPath, nycConfig);

      if (progressCallback) {
        progressCallback('执行测试...');
      }

      // 运行测试
      const nycProcess = spawn(
        'npx',
        ['nyc', '--nycrc-path', nycrcPath, 'npm', 'test'],
        {
          cwd: this.targetPath,
          stdio: 'pipe',
          shell: true,
        }
      );

      let stdoutData = '';
      let stderrData = '';

      nycProcess.stdout.on('data', (data) => {
        const message = data.toString();
        stdoutData += message;
        if (progressCallback) {
          progressCallback(message.trim());
        }
      });

      nycProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      nycProcess.on('close', (code) => {
        try {
          if (code !== 0) {
            this.logger.error(`测试执行失败，退出代码: ${code}`);
            this.logger.error(`Error: ${stderrData}`);
            throw new Error(`测试执行失败，退出代码: ${code}`);
          }

          if (progressCallback) {
            progressCallback('解析覆盖率数据...');
          }

          // 读取覆盖率数据
          const coverageSummaryPath = path.join(
            this.targetPath,
            'coverage',
            'coverage-summary.json'
          );

          if (fs.existsSync(coverageSummaryPath)) {
            const coverageData = fs.readJSONSync(
              coverageSummaryPath
            ) as ICoverageData;
            resolve(coverageData);
          } else {
            const message = '未能生成有效的覆盖率数据文件';
            this.logger.error(message);
            throw new Error(message);
          }
        } catch (error) {
          reject(error);
        } finally {
          // 清理临时文件
          try {
            fs.removeSync(nycrcPath);
          } catch (e) {
            this.logger.warn('清理临时文件失败:', e);
          }
        }
      });
    });
  }
}
