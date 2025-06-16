import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { promisify } from 'util';
import { BaseReporter, IReporterOptions } from './base-reporter';
import { AnalysisResult } from '../types/analysis-result';
import { IDuplicateAnalysisResult } from '../analyzers/duplicate-code-analyzer';
import { IUnusedCodeAnalysisResult } from '../analyzers/unused-code-analyzer';

// 将fs方法转换为Promise
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * HTML报告生成器选项
 */
export interface IHtmlReporterOptions extends IReporterOptions {
  title?: string;
  includeSourceCode?: boolean;
  includeSummaryChart?: boolean;
  theme?: 'light' | 'dark';
}

/**
 * HTML报告生成器实现
 */
export class HtmlReporter extends BaseReporter {
  protected options: IHtmlReporterOptions;

  /**
   * 创建HTML报告生成器实例
   * @param options 报告选项
   */
  constructor(options: IHtmlReporterOptions = {}) {
    super(options);

    // 使用默认值合并选项
    const defaultOptions: IHtmlReporterOptions = {
      title: '代码分析报告',
      includeSourceCode: true,
      includeSummaryChart: true,
      theme: 'light',
    };

    // 设置选项
    this.options = {
      ...defaultOptions,
      ...options,
    };
  }

  /**
   * 生成HTML报告
   * @param results 分析结果
   * @returns 生成的报告文件路径
   */
  async generate(results: AnalysisResult | AnalysisResult[]): Promise<string> {
    const resultsArray = Array.isArray(results) ? results : [results];

    // 创建输出目录
    const outputDir = this.options.outputPath || './reports';
    await mkdir(outputDir, { recursive: true });

    // 准备报告数据
    const reportData = {
      title: this.options.title,
      generatedAt: new Date().toLocaleString(),
      theme: this.options.theme,
      includeSummaryChart: this.options.includeSummaryChart,
      analyzerResults: this.prepareResultsData(resultsArray),
      dupeResults: resultsArray.filter(
        (r) => 'duplicates' in r
      ) as IDuplicateAnalysisResult[],
      unusedResults: resultsArray.filter(
        (r) => 'unusedImports' in r
      ) as IUnusedCodeAnalysisResult[],
    };

    // 生成HTML内容
    const htmlContent = await this.renderTemplate(reportData);

    // 写入文件
    const filename = this.generateFileName('html');
    const outputPath = path.join(outputDir, filename);
    await writeFile(outputPath, htmlContent);

    console.info(`HTML报告已生成: ${outputPath}`);
    return outputPath;
  }

  /**
   * 渲染HTML模板
   * @param data 报告数据
   * @returns 渲染后的HTML内容
   */
  private async renderTemplate(data: any): Promise<string> {
    // 这里使用简单的内联模板，实际项目中应该使用外部模板文件
    const template = `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><%= title %></title>
        <style>
          :root {
            --bg-color: <%= theme === 'dark' ? '#1e1e1e' : '#ffffff' %>;
            --text-color: <%= theme === 'dark' ? '#e0e0e0' : '#333333' %>;
            --header-bg: <%= theme === 'dark' ? '#252526' : '#f5f5f5' %>;
            --border-color: <%= theme === 'dark' ? '#3c3c3c' : '#ddd' %>;
            --highlight-color: <%= theme === 'dark' ? '#3b3b7c' : '#e8f0fe' %>;
            --link-color: <%= theme === 'dark' ? '#6ca9f0' : '#1a73e8' %>;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
            margin: 0;
            padding: 0;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          
          header {
            background-color: var(--header-bg);
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 30px;
            border-bottom: 3px solid var(--border-color);
          }
          
          h1, h2, h3 {
            margin-top: 0;
          }
          
          .summary-section {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid var(--border-color);
            border-radius: 5px;
          }
          
          .detail-section {
            margin-bottom: 30px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          th, td {
            padding: 10px;
            border: 1px solid var(--border-color);
            text-align: left;
          }
          
          th {
            background-color: var(--header-bg);
          }
          
          tr:nth-child(even) {
            background-color: var(--highlight-color);
          }
          
          .file-link {
            color: var(--link-color);
            text-decoration: none;
          }
          
          .file-link:hover {
            text-decoration: underline;
          }
          
          .error-count {
            font-weight: bold;
            color: #e53935;
          }
          
          .warning-count {
            font-weight: bold;
            color: #fb8c00;
          }
          
          .success {
            color: #43a047;
          }
          
          .chart-container {
            height: 400px;
            margin-bottom: 30px;
          }
          
          footer {
            text-align: center;
            padding: 20px;
            margin-top: 30px;
            font-size: 0.9em;
            border-top: 1px solid var(--border-color);
          }
        </style>
        <% if (includeSummaryChart) { %>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        <% } %>
      </head>
      <body>
        <div class="container">
          <header>
            <h1><%= title %></h1>
            <p>生成时间: <%= generatedAt %></p>
          </header>
          
          <div class="summary-section">
            <h2>分析总结</h2>
            <% if (dupeResults.length > 0) { %>
              <% const dupeResult = dupeResults[0]; %>
              <p>
                重复代码: 
                <span class="<%= dupeResult.totalDuplicates > 0 ? 'error-count' : 'success' %>">
                  <%= dupeResult.totalDuplicates %> 处，共 <%= dupeResult.duplicateLines %> 行
                </span>
              </p>
            <% } %>
            
            <% if (unusedResults.length > 0) { %>
              <% const unusedResult = unusedResults[0]; %>
              <p>
                未使用代码: 
                <span class="<%= unusedResult.totalUnused > 0 ? 'warning-count' : 'success' %>">
                  <%= unusedResult.totalUnused %> 处
                </span>
              </p>
            <% } %>
            
            <% if (includeSummaryChart && (unusedResults.length > 0 || dupeResults.length > 0)) { %>
              <div class="chart-container">
                <canvas id="summary-chart"></canvas>
              </div>
            <% } %>
          </div>
          
          <% if (dupeResults.length > 0) { %>
            <% const dupeResult = dupeResults[0]; %>
            <div class="detail-section">
              <h2>重复代码详细信息</h2>
              
              <% if (dupeResult.duplicates.size === 0) { %>
                <p class="success">未发现重复代码，做得很好！👍</p>
              <% } else { %>
                <table>
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>名称</th>
                      <th>文件</th>
                      <th>行号</th>
                      <th>重复次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <% 
                      const sortedDuplicates = Array.from(dupeResult.duplicates.values())
                        .sort((a, b) => (b.length - a.length) || (b[0].size - a[0].size)); 
                        
                      for (const dupes of sortedDuplicates) { 
                        const firstDupe = dupes[0];
                    %>
                      <tr>
                        <td><%= firstDupe.type %></td>
                        <td><%= firstDupe.name %></td>
                        <td>
                          <a href="#" class="file-link" title="<%= firstDupe.filePath %>">
                            <%= firstDupe.filePath.split('/').slice(-2).join('/') %>
                          </a>
                        </td>
                        <td><%= firstDupe.startLine %>-<%= firstDupe.endLine %></td>
                        <td><%= dupes.length %>x (<%= firstDupe.size %> 行)</td>
                      </tr>
                    <% } %>
                  </tbody>
                </table>
              <% } %>
            </div>
          <% } %>
          
          <% if (unusedResults.length > 0) { %>
            <% const unusedResult = unusedResults[0]; %>
            <div class="detail-section">
              <h2>未使用代码详细信息</h2>
              
              <% if (unusedResult.totalUnused === 0) { %>
                <p class="success">未发现未使用代码，做得很好！👍</p>
              <% } else { %>
                <h3>未使用的导入 (<%= unusedResult.unusedImports.length %>)</h3>
                
                <% if (unusedResult.unusedImports.length > 0) { %>
                  <table>
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>文件</th>
                        <th>行号</th>
                      </tr>
                    </thead>
                    <tbody>
                      <% for (const item of unusedResult.unusedImports) { %>
                        <tr>
                          <td><%= item.name %></td>
                          <td>
                            <a href="#" class="file-link" title="<%= item.filePath %>">
                              <%= item.filePath.split('/').slice(-2).join('/') %>
                            </a>
                          </td>
                          <td><%= item.line %></td>
                        </tr>
                      <% } %>
                    </tbody>
                  </table>
                <% } %>
                
                <h3>未使用的变量 (<%= unusedResult.unusedVariables.length %>)</h3>
                
                <% if (unusedResult.unusedVariables.length > 0) { %>
                  <table>
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>文件</th>
                        <th>行号</th>
                        <th>作用域</th>
                      </tr>
                    </thead>
                    <tbody>
                      <% for (const item of unusedResult.unusedVariables) { %>
                        <tr>
                          <td><%= item.name %></td>
                          <td>
                            <a href="#" class="file-link" title="<%= item.filePath %>">
                              <%= item.filePath.split('/').slice(-2).join('/') %>
                            </a>
                          </td>
                          <td><%= item.line %></td>
                          <td><%= item.scope || '-' %></td>
                        </tr>
                      <% } %>
                    </tbody>
                  </table>
                <% } %>
                
                <h3>未使用的函数 (<%= unusedResult.unusedFunctions.length %>)</h3>
                
                <% if (unusedResult.unusedFunctions.length > 0) { %>
                  <table>
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>文件</th>
                        <th>行号</th>
                      </tr>
                    </thead>
                    <tbody>
                      <% for (const item of unusedResult.unusedFunctions) { %>
                        <tr>
                          <td><%= item.name %></td>
                          <td>
                            <a href="#" class="file-link" title="<%= item.filePath %>">
                              <%= item.filePath.split('/').slice(-2).join('/') %>
                            </a>
                          </td>
                          <td><%= item.line %></td>
                        </tr>
                      <% } %>
                    </tbody>
                  </table>
                <% } %>
              <% } %>
            </div>
          <% } %>
          
          <footer>
            <p>由 Code Insight Analyst 生成</p>
          </footer>
        </div>
        
        <% if (includeSummaryChart && (unusedResults.length > 0 || dupeResults.length > 0)) { %>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('summary-chart').getContext('2d');
            
            // 准备图表数据
            const labels = [];
            const duplicateData = [];
            const unusedData = [];
            
            <% if (dupeResults.length > 0) { %>
              const dupeResult = <%= JSON.stringify(dupeResults[0]) %>;
              labels.push('重复函数', '重复方法', '重复箭头函数');
              
              // 统计各类型重复代码
              const dupeByType = new Map();
              for (const key of Object.keys(dupeResult.duplicates)) {
                const dupes = dupeResult.duplicates[key];
                const type = dupes[0].type;
                dupeByType.set(type, (dupeByType.get(type) || 0) + dupes.length);
              }
              
              duplicateData.push(
                dupeByType.get('function') || 0,
                dupeByType.get('method') || 0,
                dupeByType.get('arrowFunction') || 0
              );
            <% } %>
            
            <% if (unusedResults.length > 0) { %>
              const unusedResult = <%= JSON.stringify(unusedResults[0]) %>;
              
              if (labels.length === 0) {
                labels.push('导入', '变量', '函数', '类', '接口', '类型');
              }
              
              unusedData.push(
                unusedResult.unusedImports.length,
                unusedResult.unusedVariables.length,
                unusedResult.unusedFunctions.length,
                unusedResult.unusedClasses.length,
                unusedResult.unusedInterfaces.length,
                unusedResult.unusedTypes.length
              );
            <% } %>
            
            // 创建图表
            const chart = new Chart(ctx, {
              type: 'bar',
              data: {
                labels: labels,
                datasets: [
                  <% if (dupeResults.length > 0) { %>
                  {
                    label: '重复代码',
                    data: duplicateData,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                  },
                  <% } %>
                  <% if (unusedResults.length > 0) { %>
                  {
                    label: '未使用代码',
                    data: unusedData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                  }
                  <% } %>
                ]
              },
              options: {
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: '数量'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: '类型'
                    }
                  }
                }
              }
            });
          });
        </script>
        <% } %>
      </body>
      </html>
    `;

    return ejs.render(template, data);
  }

  /**
   * 准备报告数据
   * @param results 分析结果数组
   * @returns 处理后的报告数据
   */
  private prepareResultsData(results: AnalysisResult[]): any[] {
    return results.map((result) => {
      const analyzerName = this.getAnalyzerName(result);

      // 根据分析器类型准备详细数据
      let details = {};

      if ('duplicates' in result) {
        const dupeResult = result as IDuplicateAnalysisResult;
        details = {
          totalDuplicates: dupeResult.totalDuplicates,
          duplicateLines: dupeResult.duplicateLines,
          affectedFiles: dupeResult.affectedFiles.length,
        };
      } else if ('unusedImports' in result) {
        const unusedResult = result as IUnusedCodeAnalysisResult;
        details = {
          totalUnused: unusedResult.totalUnused,
          unusedImports: unusedResult.unusedImports.length,
          unusedVariables: unusedResult.unusedVariables.length,
          unusedFunctions: unusedResult.unusedFunctions.length,
          affectedFiles: unusedResult.affectedFiles.length,
        };
      }

      return {
        name: analyzerName,
        duration: this.formatDuration(result.duration),
        details,
      };
    });
  }
}
