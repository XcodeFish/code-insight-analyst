#!/usr/bin/env node

// 导入并执行CLI
import('../dist/cli/index.js').catch((error) => {
  console.error('执行失败:', error);
  process.exit(1);
});
