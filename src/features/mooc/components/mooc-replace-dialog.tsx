import { useMoocStore } from '../stores/mooc-store';

export function MoocReplaceDialog() {
  const open = useMoocStore((state) => state.confirmReplace);
  const confirmEnter = useMoocStore((state) => state.confirmEnter);
  const cancelEnter = useMoocStore((state) => state.cancelEnter);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-md rounded-xl border border-[#2a3a55] bg-[#121a2b] p-5 text-[#e8eef8] shadow-xl">
        <h2 className="text-base font-semibold">用慕课序列替换当前时间线？</h2>
        <p className="mt-2 text-sm leading-6 text-[#8ea0b8]">
          会按慕课文档重新编译轨道。工程里已有的片段会被这次编译替换。原来的多轨编辑还在，编译之后可以从「标准时间线」查看和导出。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-[#2a3a55] px-3 py-1.5 text-sm" onClick={cancelEnter}>取消</button>
          <button type="button" className="rounded-md bg-[#3b82f6] px-3 py-1.5 text-sm font-semibold" onClick={confirmEnter}>创建慕课序列</button>
        </div>
      </div>
    </div>
  );
}
