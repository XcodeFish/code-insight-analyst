/**
 * 操作系统模块模拟
 */
export const createMockOS = () => ({
  homedir: jest.fn().mockReturnValue('/mock/home'),
  platform: jest.fn().mockReturnValue('darwin'),
  tmpdir: jest.fn().mockReturnValue('/mock/tmp'),
  hostname: jest.fn().mockReturnValue('mock-host'),
  userInfo: jest.fn().mockReturnValue({
    username: 'mock-user',
    uid: 1000,
    gid: 1000,
    shell: '/bin/mock',
    homedir: '/mock/home',
  }),
  cpus: jest.fn().mockReturnValue([
    {
      model: 'Mock CPU',
      speed: 2800,
      times: {
        user: 859032,
        nice: 0,
        sys: 311982,
        idle: 7337699,
        irq: 0,
      },
    },
  ]),
  totalmem: jest.fn().mockReturnValue(8589934592),
  freemem: jest.fn().mockReturnValue(4294967296),
});
