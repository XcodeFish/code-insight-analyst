/* eslint-disable @typescript-eslint/no-explicit-any */
/* global jest, describe, it, expect, beforeEach, afterEach */
import { ConfigManager } from '../../../src/utils/config-manager';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

jest.mock('fs-extra');
jest.mock('path');
jest.mock('os');

describe('ConfigManager', () => {
  const mockHomeDir = '/mock/home';
  const mockConfigPath = '/mock/home/.code-insight/config.json';
  let configManager: ConfigManager;

  beforeEach(() => {
    // 重置所有模拟
    jest.resetAllMocks();

    // 模拟home目录
    (os.homedir as jest.Mock).mockReturnValue(mockHomeDir);

    // 模拟path.join
    (path.join as jest.Mock).mockImplementation((...args: string[]) =>
      args.join('/')
    );
    (path.dirname as jest.Mock).mockReturnValue('/mock/home/.code-insight');

    // 模拟文件系统
    (fs.ensureDirSync as jest.Mock).mockImplementation(() => {});
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.writeJsonSync as jest.Mock).mockImplementation(() => {});

    // 创建配置管理器实例
    configManager = new ConfigManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应创建默认配置', () => {
      expect(fs.ensureDirSync).toHaveBeenCalledWith('/mock/home/.code-insight');
      expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.writeJsonSync).toHaveBeenCalledWith(
        mockConfigPath,
        expect.objectContaining({
          permissions: {},
          lastUsedOptions: [],
          preferredMode: 'single',
          analyzers: {},
          plugins: {},
          watchMode: expect.any(Object),
        }),
        { spaces: 2 }
      );
    });

    it('应加载现有配置', () => {
      jest.resetAllMocks();

      // 模拟home目录
      (os.homedir as jest.Mock).mockReturnValue(mockHomeDir);

      // 模拟path.join
      (path.join as jest.Mock).mockImplementation((...args: string[]) =>
        args.join('/')
      );

      const mockConfig = {
        permissions: { '/test/path': true },
        lastUsedOptions: ['coverage'],
        preferredMode: 'full',
        analyzers: { example: { active: true } },
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJsonSync as jest.Mock).mockReturnValue(mockConfig);

      configManager = new ConfigManager();

      expect(fs.readJsonSync).toHaveBeenCalledWith(mockConfigPath);

      // 验证配置已正确加载
      expect(configManager.getConfig()).toEqual(mockConfig);
    });
  });

  describe('配置操作', () => {
    it('应返回完整配置', () => {
      const config = configManager.getConfig();
      expect(config).toHaveProperty('permissions');
      expect(config).toHaveProperty('lastUsedOptions');
      expect(config).toHaveProperty('preferredMode');
    });

    it('应获取特定配置项', () => {
      // 通过反射设置私有属性，用于测试
      (configManager as any).config = {
        permissions: { '/test/path': true },
        preferredMode: 'full',
      };

      expect(configManager.get('permissions')).toEqual({ '/test/path': true });
      expect(configManager.get('preferredMode')).toEqual('full');
      expect(configManager.get('nonexistent')).toBeUndefined();
    });

    it('应设置特定配置项', () => {
      configManager.set('preferredMode', 'full');

      expect(fs.writeJsonSync).toHaveBeenCalled();
      expect(configManager.get('preferredMode')).toEqual('full');
    });

    it('应设置上次使用的选项', () => {
      const options = ['coverage', 'unused-code'];
      configManager.setLastUsedOptions(options);

      expect(fs.writeJsonSync).toHaveBeenCalled();
      expect(configManager.get('lastUsedOptions')).toEqual(options);
    });

    it('应设置首选模式', () => {
      configManager.setPreferredMode('full');

      expect(fs.writeJsonSync).toHaveBeenCalled();
      expect(configManager.get('preferredMode')).toEqual('full');
    });

    it('应重置配置', () => {
      // 重置fs.writeJsonSync计数
      (fs.writeJsonSync as jest.Mock).mockClear();

      // 先设置一些自定义配置
      configManager.set('preferredMode', 'full');
      configManager.setLastUsedOptions(['coverage']);

      // 然后重置
      configManager.resetConfig();

      // 验证配置已重置为默认值
      expect(configManager.get('preferredMode')).toEqual('single');
      expect(configManager.get('lastUsedOptions')).toEqual([]);
      expect(configManager.get('permissions')).toEqual({});
      expect(fs.writeJsonSync).toHaveBeenCalledTimes(3); // 包括配置更改和重置
    });
  });

  describe('监测模式配置', () => {
    it('应包含默认的监测模式配置', () => {
      const watchConfig = configManager.get('watchMode');
      expect(watchConfig).toBeDefined();
      expect(watchConfig).toHaveProperty('enabled', false);
      expect(watchConfig).toHaveProperty('interval', 5000);
      expect(watchConfig).toHaveProperty('patterns');
      expect(watchConfig).toHaveProperty('exclude');
    });

    it('应更新监测模式配置', () => {
      const newWatchConfig = {
        enabled: true,
        interval: 2000,
        patterns: ['**/*.js'],
        exclude: ['**/node_modules/**'],
      };

      configManager.set('watchMode', newWatchConfig);

      expect(fs.writeJsonSync).toHaveBeenCalled();
      expect(configManager.get('watchMode')).toEqual(newWatchConfig);
    });
  });

  describe('插件配置', () => {
    it('应包含默认的空插件配置', () => {
      const pluginsConfig = configManager.get('plugins');
      expect(pluginsConfig).toEqual({});
    });

    it('应更新插件配置', () => {
      const pluginsConfig = {
        'test-plugin': {
          enabled: true,
          options: {
            key: 'value',
          },
        },
      };

      configManager.set('plugins', pluginsConfig);

      expect(fs.writeJsonSync).toHaveBeenCalled();
      expect(configManager.get('plugins')).toEqual(pluginsConfig);
    });
  });

  describe('错误处理', () => {
    it('应优雅地处理保存配置时的错误', () => {
      // 模拟写入文件时出错
      (fs.writeJsonSync as jest.Mock).mockImplementation(() => {
        throw new Error('写入失败');
      });

      // 这不应该抛出错误
      expect(() => configManager.saveConfig()).not.toThrow();

      // 但应该有错误日志
      // 注意：我们在setup.ts中模拟了console.error，所以这里不需要检查
    });
  });
});
