# Code Insight Analyst

代码洞察分析工具 - 一款灵活高效的代码分析与度量解决方案

## 简介

Code Insight Analyst 是一个专为开发团队设计的代码分析工具，可以帮助您深入了解代码库的结构、质量和演化过程。通过静态分析和增量扫描，它提供了关于代码复杂度、重复度、依赖关系等多维度的度量，使团队能够更好地管理技术债务并提高代码质量。

## 特性

- **多维度分析**：提供代码复杂度、重复代码、依赖关系等多角度分析
- **增量扫描**：支持仅分析变更的文件，提高分析效率
- **实时监控**：通过watch模式实时监控代码变更并进行分析
- **交互式界面**：提供简洁的命令行交互体验
- **依赖分析**：构建和可视化项目依赖关系图

## 安装

```bash
npm install -g code-insight-analyst
```

或者使用pnpm:

```bash
pnpm add -g code-insight-analyst
```

## 快速开始

### 基本用法

```bash
# 启动交互式分析模式
code-insight

# 分析当前目录下的代码
code-insight analyze

# 分析指定目录
code-insight analyze -p /path/to/project

# 监控模式，检测文件变化并自动分析
code-insight watch
```

### 依赖分析

```bash
# 分析当前项目的依赖关系
code-insight dependency

# 分析指定项目的依赖关系
code-insight dep -p ./my-project

# 生成HTML格式报告并保存到指定目录
code-insight dep -f html -o ./reports
```

### 监控模式

监控模式会持续监测项目文件的变更，并在检测到变化时自动运行分析：

```bash
# 监控当前目录
code-insight watch

# 监控指定目录，设置检测间隔
code-insight watch -p ./my-project -i 3000

# 无交互模式运行
code-insight watch --no-prompt
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
  "watchMode": {
    "enabled": true,
    "interval": 5000,
    "patterns": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    "exclude": ["**/node_modules/**", "**/dist/**"]
  },
  "dependency": {
    "includeNpm": false,
    "includeTypeImports": true,
    "generateGraph": true
  }
}
```

## 命令参考

| 命令 | 描述 |
|------|------|
| `code-insight` | 启动交互式分析模式 |
| `code-insight analyze [path]` | 分析指定路径的代码 |
| `code-insight watch [path]` | 监控代码变更并自动分析 |
| `code-insight dependency/dep [dir]` | 分析项目依赖关系 |
| `code-insight --help` | 显示帮助信息 |

### analyze 命令选项

| 选项 | 描述 |
|------|------|
| `-p, --path <path>` | 要分析的代码路径 |
| `-o, --output <o>` | 输出报告的路径 |
| `--ignore <patterns...>` | 要忽略的文件模式 |

### watch 命令选项

| 选项 | 描述 |
|------|------|
| `-p, --path <path>` | 指定项目路径 |
| `-i, --interval <ms>` | 监测间隔（毫秒） |
| `--no-prompt` | 禁用交互式提示 |
| `--analyzers <items>` | 指定要使用的分析器，逗号分隔 |

### dependency 命令选项

| 选项 | 描述 |
|------|------|
| `-p, --project <dir>` | 指定项目路径 |
| `-f, --format <format>` | 报告格式 (console, html, json) |
| `-o, --output <dir>` | 报告输出目录 |
| `-c, --circular` | 仅检测循环依赖 |
| `-v, --verbose` | 显示详细信息 |

## 系统要求

- Node.js 16.0.0 或更高版本
- npm 6.0.0 或更高版本

## 许可证

MIT

## 联系我们

- GitHub 仓库：[https://github.com/XcodeFish/code-insight-analyst](https://github.com/XcodeFish/code-insight-analyst)
- 问题追踪：[https://github.com/XcodeFish/code-insight-analyst/issues](https://github.com/XcodeFish/code-insight-analyst/issues)
