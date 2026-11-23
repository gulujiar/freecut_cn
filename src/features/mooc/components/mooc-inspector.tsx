import { useEffect, useState } from 'react';
import type { MoocSequenceDocument } from '@/types/mooc';
import { CAMERA_LABEL } from '../domain/layout';
import { formatMoocTime, locateAt } from '../domain/time';
import { serializeMoocXml } from '../domain/xml';
import { useMoocStore, type MoocMediaRole } from '../stores/mooc-store';
import { usePlaybackStore } from '@/shared/state/playback';

type Tab = 'info' | 'media' | 'xml';

function CommitField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="block text-xs text-[#8ea0b8]">
      {label}
      <input
        className="mt-1 w-full rounded border border-[#2a3a55] bg-[#0b1220] px-2 py-1 text-sm text-[#e8eef8]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
    </label>
  );
}

function DurationField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="block text-xs text-[#8ea0b8]">
      {label}
      <input
        className="mt-1 w-full rounded border border-[#2a3a55] bg-[#0b1220] px-2 py-1 text-sm text-[#e8eef8]"
        value={draft}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (!Number.isFinite(next)) {
            setDraft(String(value));
            return;
          }
          if (next !== value) onCommit(next);
        }}
      />
    </label>
  );
}

export function MoocInspector() {
  const sequence = useMoocStore((state) => state.sequence);
  const warnings = useMoocStore((state) => state.warnings);
  const importError = useMoocStore((state) => state.importError);
  const error = useMoocStore((state) => state.error);
  const fps = useMoocStore((state) => state.canvas.fps);
  const frame = usePlaybackStore((state) => state.currentFrame);
  const mediaItems = useMoocStore((state) => state.libraryMedia);
  const refreshLibrary = useMoocStore((state) => state.refreshLibrary);
  const [tab, setTab] = useState<Tab>('info');
  useEffect(() => {
    if (tab === 'media') void refreshLibrary();
  }, [refreshLibrary, tab]);
  const [xmlDraft, setXmlDraft] = useState('');

  useEffect(() => {
    if (!sequence || document.activeElement?.id === 'mooc-xml') return;
    setXmlDraft(serializeMoocXml(sequence));
  }, [sequence]);

  if (!sequence) {
    return (
      <aside className="flex h-full w-full flex-col bg-[#0e1626] p-4 text-sm text-[#8ea0b8]">
        {error ?? '慕课检查器会在创建序列后显示当前字幕、包装和素材。'}
      </aside>
    );
  }

  const place = locateAt(sequence, frame / (fps > 0 ? fps : 30));
  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-[#0e1626] text-[#e8eef8]">
      <div className="flex border-b border-[#2a3a55]">
        {([
          ['info', '当前块'],
          ['media', '素材'],
          ['xml', 'XML'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-2 py-2 text-sm ${tab === id ? 'border-b-2 border-[#3b82f6] text-white' : 'text-[#8ea0b8]'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {importError ? <p className="mb-3 whitespace-pre-wrap text-xs text-[#fb7185]">{importError}</p> : null}
        {tab === 'info' ? <InfoPane sequence={sequence} place={place} warnings={warnings} /> : null}
        {tab === 'media' ? <MediaPane sequence={sequence} mediaItems={mediaItems} /> : null}
        {tab === 'xml' ? (
          <textarea
            id="mooc-xml"
            className="h-full min-h-80 w-full resize-none rounded border border-[#2a3a55] bg-[#0b1220] p-2 font-mono text-xs text-[#dbeafe]"
            spellCheck={false}
            value={xmlDraft}
            onChange={(event) => setXmlDraft(event.target.value)}
            onBlur={() => {
              const current = serializeMoocXml(sequence);
              if (xmlDraft.trim() && xmlDraft.trim() !== current.trim()) {
                useMoocStore.getState().importXmlText(xmlDraft);
              }
            }}
          />
        ) : null}
      </div>
    </aside>
  );
}

function InfoPane({
  sequence,
  place,
  warnings,
}: {
  sequence: MoocSequenceDocument;
  place: ReturnType<typeof locateAt>;
  warnings: string[];
}) {
  const setTitle = useMoocStore((state) => state.setTitle);
  const setIntroDuration = useMoocStore((state) => state.setIntroDuration);
  const setOutroDuration = useMoocStore((state) => state.setOutroDuration);
  const setPackagingText = useMoocStore((state) => state.setPackagingText);
  const setCueText = useMoocStore((state) => state.setCueText);
  const setCueSlide = useMoocStore((state) => state.setCueSlide);

  return (
    <div className="space-y-3">
      {place.kind === 'cue' ? (
        <div className="space-y-1 text-[#8ea0b8]">
          <div><b className="text-[#e8eef8]">字幕块：</b>{place.cue.id}</div>
          <div><b className="text-[#e8eef8]">时间：</b>{formatMoocTime(place.cue.start)} → {formatMoocTime(place.cue.end)}</div>
          <div><b className="text-[#e8eef8]">机位：</b>{CAMERA_LABEL[place.cue.camera]}</div>
          <CommitField label="这一句字幕" value={place.cue.text} onCommit={(value) => setCueText(place.cue.id, value)} />
          <label className="block text-xs">
            这一句的课件
            <select
              className="mt-1 w-full rounded border border-[#2a3a55] bg-[#0b1220] px-2 py-1 text-sm"
              value={place.cue.slide}
              onChange={(event) => setCueSlide(place.cue.id, Number(event.target.value))}
            >
              {sequence.slides.map((slide, index) => (
                <option key={`${slide.label}-${index}`} value={index}>{index + 1}. {slide.label || '未命名课件'}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="text-[#8ea0b8]">
          <div><b className="text-[#e8eef8]">当前：</b>{place.kind === 'intro' ? '片头' : place.kind === 'outro' ? '片尾' : '字幕间隙'}</div>
          <div>包装段和间隙不能切机位。</div>
        </div>
      )}
      <CommitField label="课程标题" value={sequence.title} onCommit={setTitle} />
      <div className="grid grid-cols-2 gap-2">
        <DurationField label="片头秒数" value={sequence.packaging.intro.duration} onCommit={setIntroDuration} />
        <DurationField label="片尾秒数" value={sequence.packaging.outro.duration} onCommit={setOutroDuration} />
      </div>
      <CommitField label="片头标题" value={sequence.packaging.intro.title} onCommit={(value) => setPackagingText('intro', 'title', value)} />
      <CommitField label="片头副标题" value={sequence.packaging.intro.subtitle} onCommit={(value) => setPackagingText('intro', 'subtitle', value)} />
      <CommitField label="片尾标题" value={sequence.packaging.outro.title} onCommit={(value) => setPackagingText('outro', 'title', value)} />
      <CommitField label="片尾副标题" value={sequence.packaging.outro.subtitle} onCommit={(value) => setPackagingText('outro', 'subtitle', value)} />
      <p className="text-xs leading-5 text-[#8ea0b8]">
        三行机位不是可以叠在一起的剪辑轨。每一句字幕只能打开一个。改片头时长会把后面的字幕整体挪开，讲课内容相对旁白的位置保持不变。
        空格播放，1 / 2 / 3 切当前字幕的机位；焦点在输入框里时这些键留给文字。
      </p>
      <p className="text-xs leading-5 text-[#8ea0b8]">
        成片请用工具栏里现有的「导出视频」。它导出的是编译后的 FreeCut 时间线。慕课 XML 只交换序列，不是 Premiere 或 Final Cut 工程。
      </p>
      {warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-xs text-[#fbbf24]">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function MediaPane({
  sequence,
  mediaItems,
}: {
  sequence: MoocSequenceDocument;
  mediaItems: Array<{ id: string; fileName: string; mimeType: string }>;
}) {
  const importLocalFile = useMoocStore((state) => state.importLocalFile);
  const assignLibraryMedia = useMoocStore((state) => state.assignLibraryMedia);
  const clearPackagingMedia = useMoocStore((state) => state.clearPackagingMedia);
  const removeSlideAt = useMoocStore((state) => state.removeSlideAt);

  return (
    <div className="space-y-4 text-xs text-[#8ea0b8]">
      <MediaSlot
        title="旁白"
        detail={sequence.sample.audio ? '当前是示例旁白' : (sequence.audioMediaId ?? '未接入')}
        accept="audio/*"
        role="audio"
        options={mediaItems.filter((item) => item.mimeType.startsWith('audio/'))}
        onFile={importLocalFile}
        onLibrary={assignLibraryMedia}
      />
      <MediaSlot
        title="讲师"
        detail={sequence.lecturerMediaId
          ? `${sequence.sample.lecturer ? '示例' : '已接入'} · ${sequence.lecturerKind === 'image' ? '静帧' : '视频'}`
          : '未接入'}
        accept="video/*,image/*"
        role="lecturer"
        options={mediaItems.filter((item) => item.mimeType.startsWith('video/') || item.mimeType.startsWith('image/'))}
        onFile={importLocalFile}
        onLibrary={assignLibraryMedia}
      />
      <MediaSlot
        title="共享背景"
        detail={sequence.sample.background ? '当前是示例背景，几何固定' : (sequence.backgroundMediaId ?? '纯色背景')}
        accept="image/*"
        role="background"
        options={mediaItems.filter((item) => item.mimeType.startsWith('image/'))}
        onFile={importLocalFile}
        onLibrary={assignLibraryMedia}
      />
      <MediaSlot
        title="片头素材"
        detail={sequence.packaging.intro.mediaId ?? '使用标题文字'}
        accept="video/*,image/*"
        role="intro"
        options={mediaItems.filter((item) => !item.mimeType.startsWith('audio/'))}
        onFile={importLocalFile}
        onLibrary={assignLibraryMedia}
      />
      {sequence.packaging.intro.mediaId ? (
        <button type="button" className="text-[#93c5fd]" onClick={() => clearPackagingMedia('intro')}>片头改回标题文字</button>
      ) : null}
      <MediaSlot
        title="片尾素材"
        detail={sequence.packaging.outro.mediaId ?? '使用标题文字'}
        accept="video/*,image/*"
        role="outro"
        options={mediaItems.filter((item) => !item.mimeType.startsWith('audio/'))}
        onFile={importLocalFile}
        onLibrary={assignLibraryMedia}
      />
      {sequence.packaging.outro.mediaId ? (
        <button type="button" className="text-[#93c5fd]" onClick={() => clearPackagingMedia('outro')}>片尾改回标题文字</button>
      ) : null}
      <div>
        <div className="mb-1 text-[#e8eef8]">课件</div>
        <ul className="space-y-1">
          {sequence.slides.map((slide, index) => (
            <li key={`${slide.mediaId ?? 'slide'}-${index}`} className="flex items-center justify-between gap-2">
              <span>{index + 1}. {slide.sample ? '示例 · ' : ''}{slide.label || '未命名'}</span>
              <button type="button" className="text-[#fb7185]" onClick={() => removeSlideAt(index)}>移除</button>
            </li>
          ))}
        </ul>
        <MediaSlot
          title="追加课件图片"
          detail="从本地或素材库加入"
          accept="image/*"
          role="slide"
          options={mediaItems.filter((item) => item.mimeType.startsWith('image/'))}
          onFile={importLocalFile}
          onLibrary={assignLibraryMedia}
        />
      </div>
    </div>
  );
}

function MediaSlot({
  title,
  detail,
  accept,
  role,
  options,
  onFile,
  onLibrary,
}: {
  title: string;
  detail: string;
  accept: string;
  role: MoocMediaRole;
  options: Array<{ id: string; fileName: string }>;
  onFile: (role: MoocMediaRole, file: File) => void;
  onLibrary: (role: MoocMediaRole, mediaId: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[#e8eef8]">{title}</div>
      <div>{detail}</div>
      <div className="flex gap-2">
        <label className="rounded border border-[#2a3a55] px-2 py-1">
          本地文件
          <input
            className="hidden"
            type="file"
            accept={accept}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(role, file);
              event.target.value = '';
            }}
          />
        </label>
        <select
          className="min-w-0 flex-1 rounded border border-[#2a3a55] bg-[#0b1220] px-1 py-1"
          value=""
          onChange={(event) => {
            if (event.target.value) onLibrary(role, event.target.value);
          }}
        >
          <option value="">从素材库选择</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>{item.fileName}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
