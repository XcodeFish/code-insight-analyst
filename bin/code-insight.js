#!/usr/bin/env node
try {
  import('../dist/cli/index.js');
} catch (error) {
  console.error('执行失败:', error);
  process.exit(1);
}
