import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { DependencyAnalysisResult } from '../../types/dependency-types';

/**
 * 报告类型枚举
 */
export enum ReportType {
  CONSOLE = 'console',
  HTML = 'html',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

/**
 * 报告生成选项
 */
export interface ReportOptions {
  /**
   * 报告类型
   */
  type: ReportType;

  /**
   * 报告输出路径
   */
  outputPath?: string;

  /**
   * 项目名称
   */
  projectName?: string;

  /**
   * 是否包含详细信息
   */
  detailed?: boolean;
}

/**
 * 基础报告数据类型
 */
export type ReportData = Record<string, unknown>;

/**
 * 基础报告生成器
 */
export class ReportGenerator {
  /**
   * 生成报告
   * @param data 分析结果数据
   * @param options 报告选项
   * @returns 报告文件路径或控制台输出的结果
   */
  async generate(data: ReportData, options: ReportOptions): Promise<string> {
    switch (options.type) {
      case ReportType.CONSOLE:
        return this.generateConsoleReport(data, options);
      case ReportType.HTML:
        return this.generateHtmlReport(data, options);
      case ReportType.JSON:
        return this.generateJsonReport(data, options);
      case ReportType.MARKDOWN:
        return this.generateMarkdownReport(data, options);
      default:
        throw new Error(`不支持的报告类型: ${options.type}`);
    }
  }

  /**
   * 生成控制台报告
   */
  protected generateConsoleReport(
    data: ReportData,
    options: ReportOptions
  ): string {
    // 控制台报告直接输出，可以根据数据类型自动选择合适的表示方式
    return this.formatDataForConsole(data, options);
  }

  /**
   * 生成HTML报告
   */
  protected generateHtmlReport(
    data: ReportData,
    options: ReportOptions
  ): string {
    const outputPath = options.outputPath || './report.html';
    const htmlContent = this.formatDataForHtml(data, options);

    fs.writeFileSync(outputPath, htmlContent, 'utf8');
    return path.resolve(outputPath);
  }

  /**
   * 生成JSON报告
   */
  protected generateJsonReport(
    data: ReportData,
    options: ReportOptions
  ): string {
    const outputPath = options.outputPath || './report.json';
    const jsonContent = JSON.stringify(data, this.jsonReplacer, 2);

    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    return path.resolve(outputPath);
  }

  /**
   * 生成Markdown报告
   */
  protected generateMarkdownReport(
    data: ReportData,
    options: ReportOptions
  ): string {
    const outputPath = options.outputPath || './report.md';
    const mdContent = this.formatDataForMarkdown(data, options);

    fs.writeFileSync(outputPath, mdContent, 'utf8');
    return path.resolve(outputPath);
  }

  /**
   * 格式化数据用于控制台输出
   */
  protected formatDataForConsole(
    data: ReportData,
    options: ReportOptions
  ): string {
    if (!data) return '无数据';

    // 根据数据类型生成适合的表格或文本
    // 这是一个基础实现，子类可以针对特定数据类型覆盖此方法

    // 根据选项决定显示格式
    const detailed = options.detailed || false;
    const indent = detailed ? 2 : 1;

    return JSON.stringify(data, null, indent);
  }

  /**
   * 格式化数据用于HTML输出
   */
  protected formatDataForHtml(
    data: ReportData,
    options: ReportOptions
  ): string {
    // 创建一个基本的HTML模板，可以在子类中扩展
    const title = options.projectName
      ? `${options.projectName} - 分析报告`
      : '代码分析报告';

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      margin: 0;
      padding: 20px;
      color: #333;
      line-height: 1.5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
    tr:hover { background-color: #f8f9fa; }
    .summary { background-color: #f9f9f9; padding: 20px; border-radius: 5px; }
    .warning { color: #e74c3c; }
    .info { color: #3498db; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>
    <div class="content">
      ${this.dataToHtml(data, options)}
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * 格式化数据用于Markdown输出
   */
  protected formatDataForMarkdown(
    data: ReportData,
    options: ReportOptions
  ): string {
    const title = options.projectName
      ? `${options.projectName} - 分析报告`
      : '代码分析报告';

    return `# ${title}
    
生成时间: ${new Date().toLocaleString()}

${this.dataToMarkdown(data, options)}
`;
  }

  /**
   * 将JSON数据转换为适合在控制台显示的表格格式
   */
  protected jsonToTable(data: Record<string, unknown>): string {
    const table = new Table({
      head: ['属性', '值'],
      style: { head: ['cyan'] },
    });

    Object.entries(data).forEach(([key, value]) => {
      table.push([key, this.formatValue(value)]);
    });

    return table.toString();
  }

  /**
   * 将值格式化为适合显示的文本
   */
  protected formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.length ? `[${value.length} 项]` : '[]';
      } else {
        return '{...}';
      }
    }

    return String(value);
  }

  /**
   * 将数据转换为HTML格式
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected dataToHtml(data: ReportData, _options: ReportOptions): string {
    // 默认实现，子类应覆盖此方法以提供特定数据类型的HTML表示
    if (!data) return '<p>无数据</p>';

    if (typeof data === 'object') {
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    return `<p>${String(data)}</p>`;
  }

  /**
   * 将数据转换为Markdown格式
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected dataToMarkdown(data: ReportData, _options: ReportOptions): string {
    // 默认实现，子类应覆盖此方法以提供特定数据类型的Markdown表示
    if (!data) return '无数据';

    if (typeof data === 'object') {
      return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
    }

    return String(data);
  }

  /**
   * JSON.stringify 的替换函数，用于处理Map等特殊对象
   */
  private jsonReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  }
}

/**
 * 依赖分析报告生成器
 */
export class DependencyReportGenerator extends ReportGenerator {
  /**
   * 格式化依赖分析结果用于控制台输出
   * @override
   */
  protected formatDataForConsole(
    data: ReportData,
    options: ReportOptions
  ): string {
    // 类型断言，确保依赖分析数据类型正确
    const dependencyData = data as unknown as DependencyAnalysisResult;
    if (!dependencyData) return '无依赖分析数据';

    const { stats, graph } = dependencyData;
    let output = '';

    // 添加标题
    output += `\n${chalk.bold.blue('依赖关系分析报告')}\n\n`;

    // 添加统计信息
    output += chalk.yellow('📊 统计概览:\n');
    const statsTable = new Table({
      style: { head: [], border: [] },
    });

    statsTable.push(
      { 文件总数: stats.totalFiles },
      { 依赖总数: stats.totalDependencies },
      { 循环依赖数: stats.circularDependencyCount },
      { 最大依赖深度: stats.maxDependencyLevel },
      {
        被依赖最多: `${stats.mostDepended.id} (${stats.mostDepended.count}次)`,
      },
      { 依赖最多: `${stats.mostDependsOn.id} (${stats.mostDependsOn.count}次)` }
    );
    output += statsTable.toString() + '\n\n';

    // 添加循环依赖信息
    if (graph.circularDependencies.length > 0) {
      output += chalk.red('🔄 检测到循环依赖:\n');
      const circularTable = new Table({
        head: ['序号', '循环路径', '长度'],
        style: { head: ['red'] },
      });

      graph.circularDependencies.slice(0, 5).forEach((dep, index) => {
        circularTable.push([index + 1, dep.cycle.join(' → '), dep.length]);
      });

      if (graph.circularDependencies.length > 5) {
        output += circularTable.toString() + '\n';
        output += chalk.yellow(
          `...共检测到 ${graph.circularDependencies.length} 个循环依赖问题\n\n`
        );
      } else {
        output += circularTable.toString() + '\n\n';
      }
    } else {
      output += chalk.green('✓ 未检测到循环依赖\n\n');
    }

    // 如果需要详细信息
    if (options.detailed && dependencyData.counts) {
      output += chalk.yellow('📋 依赖最多的文件 (Top 10):\n');
      const countsArray = Array.from(dependencyData.counts.entries());

      // 排序并获取前10个依赖最多的文件
      const topOutgoing = countsArray
        .sort((a, b) => b[1].outgoing - a[1].outgoing)
        .slice(0, 10);

      if (topOutgoing.length > 0) {
        const topTable = new Table({
          head: ['文件', '依赖数量'],
          style: { head: ['cyan'] },
        });

        topOutgoing.forEach(([file, counts]) => {
          topTable.push([file, counts.outgoing]);
        });

        output += topTable.toString() + '\n\n';
      }
    }

    return output;
  }

  /**
   * 格式化依赖数据用于HTML输出
   * @override
   */
  protected dataToHtml(data: ReportData, options: ReportOptions): string {
    // 类型断言，确保依赖分析数据类型正确
    const dependencyData = data as unknown as DependencyAnalysisResult;
    if (!dependencyData) return '<p>无依赖分析数据</p>';

    const { stats, graph } = dependencyData;
    let html = '';

    // 添加概览部分
    html += `
    <div class="section summary">
      <h2>📊 统计概览</h2>
      <table>
        <tr><td>文件总数</td><td>${stats.totalFiles}</td></tr>
        <tr><td>依赖总数</td><td>${stats.totalDependencies}</td></tr>
        <tr><td>循环依赖数</td><td>${stats.circularDependencyCount}</td></tr>
        <tr><td>最大依赖深度</td><td>${stats.maxDependencyLevel}</td></tr>
        <tr><td>被依赖最多</td><td>${stats.mostDepended.id} (${stats.mostDepended.count}次)</td></tr>
        <tr><td>依赖最多</td><td>${stats.mostDependsOn.id} (${stats.mostDependsOn.count}次)</td></tr>
      </table>
    </div>`;

    // 添加循环依赖信息
    if (graph.circularDependencies.length > 0) {
      html += `
      <div class="section">
        <h2 class="warning">🔄 检测到循环依赖</h2>
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th>循环路径</th>
              <th>长度</th>
            </tr>
          </thead>
          <tbody>`;

      const displayCircular = graph.circularDependencies.slice(0, 20); // 限制显示数量
      displayCircular.forEach((dep, index) => {
        html += `
            <tr>
              <td>${index + 1}</td>
              <td>${dep.cycle.join(' → ')}</td>
              <td>${dep.length}</td>
            </tr>`;
      });

      html += `
          </tbody>
        </table>
        ${
          graph.circularDependencies.length > 20
            ? `<p class="info">...共检测到 ${graph.circularDependencies.length} 个循环依赖问题</p>`
            : ''
        }
      </div>`;
    } else {
      html += `
      <div class="section">
        <h2 class="info">✓ 未检测到循环依赖</h2>
      </div>`;
    }

    // 如果需要详细信息
    if (options.detailed && dependencyData.counts) {
      html += `
      <div class="section">
        <h2>📋 依赖详情</h2>`;

      // 依赖最多的文件
      const countsArray = Array.from(dependencyData.counts.entries());
      const topOutgoing = countsArray
        .sort((a, b) => b[1].outgoing - a[1].outgoing)
        .slice(0, 20);

      html += `
        <h3>依赖最多的文件 (Top 20)</h3>
        <table>
          <thead>
            <tr>
              <th>文件</th>
              <th>依赖数量</th>
            </tr>
          </thead>
          <tbody>`;

      topOutgoing.forEach(([file, counts]) => {
        html += `
            <tr>
              <td>${file}</td>
              <td>${counts.outgoing}</td>
            </tr>`;
      });

      html += `
          </tbody>
        </table>
      </div>`;
    }

    return html;
  }

  /**
   * 格式化依赖数据用于Markdown输出
   * @override
   */
  protected dataToMarkdown(data: ReportData, options: ReportOptions): string {
    // 类型断言，确保依赖分析数据类型正确
    const dependencyData = data as unknown as DependencyAnalysisResult;
    if (!dependencyData) return '无依赖分析数据';

    const { stats, graph } = dependencyData;
    let md = '';

    // 添加概览部分
    md += `## 📊 统计概览

| 指标 | 值 |
|------|-----|
| 文件总数 | ${stats.totalFiles} |
| 依赖总数 | ${stats.totalDependencies} |
| 循环依赖数 | ${stats.circularDependencyCount} |
| 最大依赖深度 | ${stats.maxDependencyLevel} |
| 被依赖最多 | ${stats.mostDepended.id} (${stats.mostDepended.count}次) |
| 依赖最多 | ${stats.mostDependsOn.id} (${stats.mostDependsOn.count}次) |

`;

    // 添加循环依赖信息
    if (graph.circularDependencies.length > 0) {
      md += `## 🔄 检测到循环依赖

| 序号 | 循环路径 | 长度 |
|------|---------|------|
`;

      const displayCircular = graph.circularDependencies.slice(0, 10); // 限制显示数量
      displayCircular.forEach((dep, index) => {
        md += `| ${index + 1} | ${dep.cycle.join(' → ')} | ${dep.length} |
`;
      });

      if (graph.circularDependencies.length > 10) {
        md += `\n_...共检测到 ${graph.circularDependencies.length} 个循环依赖问题_\n\n`;
      }
    } else {
      md += `## ✓ 未检测到循环依赖\n\n`;
    }

    // 如果需要详细信息
    if (options.detailed && dependencyData.counts) {
      md += `## 📋 依赖详情\n\n`;

      // 依赖最多的文件
      const countsArray = Array.from(dependencyData.counts.entries());
      const topOutgoing = countsArray
        .sort((a, b) => b[1].outgoing - a[1].outgoing)
        .slice(0, 10);

      md += `### 依赖最多的文件 (Top 10)\n\n`;
      md += `| 文件 | 依赖数量 |\n|------|--------|\n`;

      topOutgoing.forEach(([file, counts]) => {
        md += `| ${file} | ${counts.outgoing} |\n`;
      });

      md += '\n';
    }

    return md;
  }
}
