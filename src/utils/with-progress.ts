import { Listr, ListrTask, DefaultRenderer } from 'listr2';

/**
 * 进度任务接口，基本结构与Listr2所需的任务结构兼容
 */
export interface ITask<T = any> {
  title: string;
  task: (ctx: T, task?: any) => Promise<any>;
  skip?: (ctx: T) => boolean | string | Promise<boolean | string>;
}

/**
 * 带进度条执行一系列任务
 * @param tasks 要执行的任务列表
 * @param title 任务组标题
 * @param options Listr选项
 * @returns 任务执行结果
 */
export async function withProgress<T = any>(
  tasks: ITask<T>[],
  title?: string,
  options: any = {}
): Promise<T> {
  // 使用unknown类型中转避免复杂类型错误
  const listrTasks = tasks as unknown as ListrTask<T, typeof DefaultRenderer>[];

  const listr = new Listr<T>(listrTasks, {
    concurrent: false,
    exitOnError: true,
    rendererOptions: {
      collapse: false,
      collapseSkips: true,
    },
    ...options,
  });

  if (title) {
    console.log(`\n${title}\n`);
  }

  return await listr.run();
}
