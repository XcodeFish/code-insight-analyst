/**
 * 测试前全局设置
 */
import type * as Jest from '@jest/types';

// 设置测试环境变量
process.env.NODE_ENV = 'test';

// 设置测试超时时间
jest.setTimeout(10000);

// 确保全局类型定义正确
declare global {
  var describe: Jest.Global.Describe;

  var it: Jest.Global.It;

  var test: Jest.Global.It;

  var expect: Jest.Global.Expect;

  var beforeEach: Jest.Global.Lifecycle;

  var afterEach: Jest.Global.Lifecycle;

  var beforeAll: Jest.Global.Lifecycle;

  var afterAll: Jest.Global.Lifecycle;
}

// 关闭console输出，使测试输出更清晰
global.console = {
  ...console,
  // 注释下面行可以开启调试日志输出
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // 保留警告和错误，以便查看问题
  warn: console.warn,
  error: console.error,
};

// 添加自定义匹配器
expect.extend({
  // 例如检查某个值是否接近另一个值（带误差范围）
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `预期 ${received} 不在 ${floor} - ${ceiling} 范围内`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期 ${received} 在 ${floor} - ${ceiling} 范围内`,
        pass: false,
      };
    }
  },
});

// 全局清理函数，在每个测试文件执行后运行
afterAll(() => {
  // 清理可能的全局状态
  jest.clearAllMocks();
});
