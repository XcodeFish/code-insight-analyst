/* global jest */
/**
 * 创建模拟权限管理器
 */

export function createMockPermissionManager() {
  // 存储权限状态
  const permissions: Record<string, boolean> = {
    'fs.read': true,
    'fs.write': true,
    network: true,
    plugin: true,
    analyzer: true,
  };

  // 存储授权路径
  const authorizedPaths = new Set<string>(['/test/project']);

  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    checkPermission: jest.fn().mockImplementation((permission: string) => {
      return permissions[permission] || false;
    }),
    isAuthorized: jest.fn().mockImplementation((path: string) => {
      return authorizedPaths.has(path);
    }),
    addAuthorizedPath: jest.fn().mockImplementation((path: string) => {
      authorizedPaths.add(path);
    }),
    removeAuthorizedPath: jest.fn().mockImplementation((path: string) => {
      authorizedPaths.delete(path);
    }),
    getAuthorizedPaths: jest.fn().mockReturnValue(authorizedPaths),
    requestPermission: jest
      .fn()
      .mockImplementation(async (permission: string, reason: string) => {
        // 默认所有权限请求被接受
        permissions[permission] = true;
        return true;
      }),
    getPermissions: jest.fn().mockReturnValue(permissions),
    savePermissions: jest.fn().mockResolvedValue(undefined),
    // 测试辅助方法
    __setPermission: jest
      .fn()
      .mockImplementation((permission: string, value: boolean) => {
        permissions[permission] = value;
      }),
    __resetPermissions: jest.fn().mockImplementation(() => {
      Object.keys(permissions).forEach((key) => {
        permissions[key] = true;
      });
    }),
    __addAuthorizedPath: jest.fn().mockImplementation((path: string) => {
      authorizedPaths.add(path);
    }),
    __clearAuthorizedPaths: jest.fn().mockImplementation(() => {
      authorizedPaths.clear();
    }),
  };
}
