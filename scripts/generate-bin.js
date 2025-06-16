#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 确保bin目录存在
const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// 创建执行文件
const binFile = path.join(binDir, 'code-insight.js');
fs.writeFileSync(
  binFile,
  `#!/usr/bin/env node
try {
  require('../dist/cli/index.js');
} catch (error) {
  console.error('执行失败:', error);
  process.exit(1);
}
`,
  'utf8'
);

// 设置执行权限
fs.chmodSync(binFile, 0o755);

console.log('✨ 生成二进制文件成功');
