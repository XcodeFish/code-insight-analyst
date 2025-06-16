/**
 * madge库的类型声明
 */
declare module 'madge' {
  export interface MadgeConfig {
    baseDir?: string;
    excludeRegExp?: RegExp[];
    fileExtensions?: string[];
    includeNpm?: boolean;
    requireConfig?: string;
    webpackConfig?: string;
    tsConfig?: string;
    detectiveOptions?: {
      ts?: {
        skipTypeImports?: boolean;
      };
      [key: string]: any;
    };
  }

  export interface MadgeInstance {
    obj(): Record<string, string[]>;
    circular(): {
      getArray(): string[][];
    };
    depends(): string[];
    orphans(): string[];
    dot(): string;
    json(): string;
  }

  const madge: (path: string, config?: MadgeConfig) => Promise<MadgeInstance>;

  export default madge;
}

/**
 * glob库的类型声明
 */
declare module 'glob' {
  export interface IOptions {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nomount?: boolean;
    mark?: boolean;
    nosort?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: boolean | object;
    statCache?: object;
    symlinks?: object;
    sync?: boolean;
    nounique?: boolean;
    nonull?: boolean;
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nodir?: boolean;
    ignore?: string | string[];
    follow?: boolean;
    realpath?: boolean;
    absolute?: boolean;
  }

  export function glob(
    pattern: string,
    options?: IOptions,
    cb?: (err: Error | null, matches: string[]) => void
  ): void;

  export function sync(pattern: string, options?: IOptions): string[];

  export function hasMagic(pattern: string, options?: IOptions): boolean;
}
