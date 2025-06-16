#!/usr/bin/env node

import { default as cli } from '../dist/cli/index.js';

try {
  cli();
} catch (err) {
  console.error('启动失败:', err);
  process.exit(1);
}
