# Code Insight Analyst

代码分析工具，用于检测代码质量、覆盖率、重复、未使用代码和潜在问题。

## 功能特点

- 代码覆盖率分析
- 重复代码检测
- 未使用代码检测
- 依赖关系分析
- 内存泄漏检测（实验性）
- 死循环风险检测（实验性）
- 结构目录分析

## 安装方式

```bash
# 全局安装
npm install -g code-insight-analyst

# 或使用 pnpm
pnpm add -g code-insight-analyst
```

## 基本用法

```bash
# 分析当前目录
code-insight

# 分析指定目录
code-insight -d ./your-project

# 使用配置文件
code-insight -c .insightrc

# 输出分析报告
code-insight -o report.html
```

## 开发指南

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建项目

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范，提交格式为：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

类型包括：

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `ci`: CI相关
- `revert`: 回滚

## 许可证

MIT
