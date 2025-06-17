/* global jest */
import { ConfigManager } from '../../src/utils/config-manager';

/**
 * 创建模拟的 ConfigManager
 */
export function createMockConfigManager(): jest.Mocked<ConfigManager> {
  const defaultConfig = {
    permissions: {},
    lastUsedOptions: [],
    preferredMode: 'single',
    analyzers: {},
    plugins: {},
    watchMode: {
      enabled: false,
      interval: 5000,
      patterns: ['**/*.ts', '**/*.js'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  };

  const mockConfigManager = {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    getConfig: jest.fn().mockReturnValue(defaultConfig),
    get: jest.fn().mockImplementation((key) => defaultConfig[key]),
    set: jest.fn(),
    setLastUsedOptions: jest.fn(),
    setPreferredMode: jest.fn(),
    resetConfig: jest.fn(),
    saveConfig: jest.fn(),
    setPermission: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true),
    getPluginConfig: jest.fn().mockReturnValue({}),
    setPluginConfig: jest.fn(),
  } as unknown as jest.Mocked<ConfigManager>;

  return mockConfigManager;
}
