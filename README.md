# Code Insight Analyst

代码洞察分析工具 - 一款灵活高效的代码分析与度量解决方案

## 简介

Code Insight Analyst 是一个专为开发团队设计的代码分析工具，可以帮助您深入了解代码库的结构、质量和演化过程。通过静态分析和增量扫描，它提供了关于代码复杂度、重复度、依赖关系等多维度的度量，使团队能够更好地管理技术债务并提高代码质量。

## 特性

- **多维度分析**：提供代码复杂度、重复代码、依赖关系等多角度分析
- **增量扫描**：支持仅分析变更的文件，提高分析效率
- **插件系统**：通过插件机制灵活扩展分析功能
- **命令行界面**：简单直观的命令行操作体验
- **可视化报告**：生成清晰直观的分析报告
- **持续集成**：易于集成到CI/CD流程中

## 安装

```bash
npm install -g code-insight-analyst
```

## 快速开始

### 基本用法

```bash
# 分析当前目录下的代码
code-insight analyze

# 分析指定目录
code-insight analyze /path/to/project

# 生成分析报告
code-insight analyze --report

# 监控模式，检测文件变化并自动分析
code-insight watch
```

### 配置文件

在项目根目录创建 `.code-insightrc.json` 文件可以自定义分析行为：

```json
{
  "include": ["src/**/*.ts", "src/**/*.js"],
  "exclude": ["**/*.test.ts", "**/*.spec.js", "node_modules/**"],
  "metrics": {
    "complexity": {
      "threshold": 15
    },
    "duplication": {
      "threshold": 3
    }
  },
  "plugins": {
    "code-metrics-plugin": {
      "enabled": true,
      "options": {
        "detailedReport": true
      }
    }
  }
}
```

## 插件系统

Code Insight Analyst 采用插件架构，可以轻松扩展其功能：

### 使用插件

```bash
# 安装插件
code-insight plugin install code-metrics-plugin

# 列出已安装的插件
code-insight plugin list

# 启用/禁用插件
code-insight plugin enable code-metrics-plugin
code-insight plugin disable code-metrics-plugin
```

### 开发插件

创建一个 Code Insight 插件非常简单：

```typescript
// my-custom-plugin/index.js
module.exports = {
  default: {
    name: 'my-custom-plugin',
    version: '1.0.0',
    description: '自定义分析插件',
    author: '你的名字',

    async initialize() {
      // 插件初始化逻辑
    },

    async execute(context) {
      // 执行分析逻辑
      return {
        success: true,
        data: {
          // 分析结果
        }
      };
    },

    async cleanup() {
      // 插件清理逻辑
    }
  }
};
```

## 命令参考

| 命令 | 描述 |
|------|------|
| `code-insight analyze [path]` | 分析指定路径的代码 |
| `code-insight watch [path]` | 监控代码变更并自动分析 |
| `code-insight report` | 生成分析报告 |
| `code-insight plugin list` | 列出已安装的插件 |
| `code-insight plugin install <name>` | 安装插件 |
| `code-insight plugin uninstall <name>` | 卸载插件 |
| `code-insight plugin enable <name>` | 启用插件 |
| `code-insight plugin disable <name>` | 禁用插件 |
| `code-insight config set <key> <value>` | 设置配置项 |
| `code-insight config get <key>` | 获取配置项 |
| `code-insight --help` | 显示帮助信息 |

## 分析指标说明

- **复杂度分析**：包括圈复杂度、认知复杂度等度量
- **代码重复分析**：识别重复代码块及其分布
- **依赖分析**：构建模块间依赖关系图
- **代码异味检测**：识别潜在的代码问题和优化机会
- **变更影响分析**：评估代码变更的影响范围

## 集成到 CI/CD

### GitHub Actions 示例

```yaml
name: Code Analysis

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '16'
    - run: npm install -g code-insight-analyst
    - name: Run Code Analysis
      run: code-insight analyze --report
    - name: Upload Report
      uses: actions/upload-artifact@v3
      with:
        name: code-insight-report
        path: .code-insight/reports/
```

## 系统要求

- Node.js 14.0.0 或更高版本
- npm 6.0.0 或更高版本

## 许可证

MIT

## 贡献指南

欢迎贡献代码、报告问题或提出建议！请查看我们的[贡献指南](CONTRIBUTING.md)了解更多信息。

## 联系我们

- GitHub 仓库：[https://github.com/yourusername/code-insight-analyst](https://github.com/yourusername/code-insight-analyst)
- 问题追踪：[https://github.com/yourusername/code-insight-analyst/issues](https://github.com/yourusername/code-insight-analyst/issues)
