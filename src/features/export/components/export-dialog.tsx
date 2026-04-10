import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Film,
  Clock,
  HardDrive,
  Music,
  Video,
  Scissors,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExportSettings, ExportMode } from '@/types/export';
import { useClientRender } from '../hooks/use-client-render';
import { useProjectStore } from '@/features/export/deps/projects';
import { useTimelineStore } from '@/features/export/deps/timeline';
import { formatTimecode, framesToSeconds } from '@/utils/time-utils';
import {
  getCompatibleVideoCodecs,
  getDefaultVideoCodec,
  mapExportCodecToClientCodec,
  type ClientCodec,
  type ClientVideoContainer,
  type ClientAudioContainer,
} from '../utils/client-renderer';
import { ExportPreviewPlayer } from './export-preview-player';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type DialogView = 'settings' | 'progress' | 'complete' | 'error' | 'cancelled';

type VideoContainerOption = {
  value: ClientVideoContainer;
  label: string;
  description: string;
  supported: boolean;
};

type VideoCodecOption = {
  value: ExportSettings['codec'];
  label: string;
  supported: boolean;
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generate resolution options based on project dimensions.
 */
function getResolutionOptions(projectWidth: number, projectHeight: number, t: any) {
  const scales = [1, 0.666, 0.5];

  return scales.map((scale) => {
    const w = Math.round(projectWidth * scale);
    const h = Math.round(projectHeight * scale);
    const width = w % 2 === 0 ? w : w + 1;
    const height = h % 2 === 0 ? h : h + 1;

    const label =
      scale === 1
        ? t('dialogs.export.sameAsProject', { width, height })
        : `${Math.min(width, height)}p (${width}×${height})`;

    return { value: `${width}x${height}`, label };
  });
}

function getDefaultCodecForFormat(
  format: 'mp4' | 'webm'
): ExportSettings['codec'] {
  return getDefaultVideoCodec(format);
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const projectWidth = useProjectStore((s) => s.currentProject?.metadata.width ?? 1920);
  const projectHeight = useProjectStore((s) => s.currentProject?.metadata.height ?? 1080);
  const fps = useTimelineStore((s) => s.fps);
  const items = useTimelineStore((s) => s.items);
  const inPoint = useTimelineStore((s) => s.inPoint);
  const outPoint = useTimelineStore((s) => s.outPoint);

  const [settings, setSettings] = useState<ExportSettings>({
    codec: getDefaultCodecForFormat('mp4'),
    quality: 'high',
    resolution: { width: projectWidth, height: projectHeight },
  });

  const [exportMode, setExportMode] = useState<ExportMode>('video');
  const [videoContainer, setVideoContainer] = useState<ClientVideoContainer>('mp4');
  const [audioContainer, setAudioContainer] = useState<ClientAudioContainer>('mp3');
  const [view, setView] = useState<DialogView>('settings');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [renderWholeProject, setRenderWholeProject] = useState(false);
  const wasOpenRef = useRef(false);

  const timelineDurationFrames = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => item.from + item.durationInFrames));
  }, [items]);

  const hasInOutPoints = inPoint !== null && outPoint !== null && outPoint > inPoint;

  const exportRange = useMemo(() => {
    if (renderWholeProject || !hasInOutPoints) {
      return { start: 0, end: timelineDurationFrames, duration: timelineDurationFrames };
    }
    const start = inPoint ?? 0;
    const end = outPoint ?? timelineDurationFrames;
    return { start, end, duration: end - start };
  }, [renderWholeProject, hasInOutPoints, inPoint, outPoint, timelineDurationFrames]);

  const resolutionOptions = useMemo(
    () => getResolutionOptions(projectWidth, projectHeight, t),
    [projectWidth, projectHeight, t]
  );

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      resolution: { width: projectWidth, height: projectHeight },
    }));
  }, [projectWidth, projectHeight]);

  const clientRender = useClientRender();

  const {
    progress,
    renderedFrames,
    totalFrames,
    status,
    error,
    startExport,
    cancelExport,
    downloadVideo,
    resetState,
    getSupportedCodecs,
  } = clientRender;

  const [supportedVideoCodecs, setSupportedVideoCodecs] = useState<ClientCodec[] | null>(null);
  const [isCheckingVideoSupport, setIsCheckingVideoSupport] = useState(false);
  const [videoSupportError, setVideoSupportError] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'progress' && !startTime) {
      setStartTime(Date.now());
    }
    if (view === 'settings') {
      setStartTime(null);
      setElapsedSeconds(0);
    }
  }, [view, startTime]);

  useEffect(() => {
    if (!startTime || view !== 'progress') return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, view]);

  useEffect(() => {
    if (status === 'completed') {
      setView('complete');
    } else if (status === 'failed') {
      setView('error');
    } else if (status === 'cancelled') {
      setView('cancelled');
    }
  }, [status]);

  const handleClose = () => {
    if (view === 'progress') return;
    setView('settings');
    resetState();
    onClose();
  };

  const handleStartExport = async () => {
    setView('progress');
    const extendedSettings = {
      ...settings,
      mode: exportMode,
      videoContainer: exportMode === 'video' ? videoContainer : undefined,
      audioContainer: exportMode === 'audio' ? audioContainer : undefined,
      renderWholeProject,
    };
    await startExport(extendedSettings);
  };

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setView('settings');
      setExportMode('video');
      setVideoContainer('mp4');
      setAudioContainer('mp3');
      setRenderWholeProject(false);
      setSettings({
        codec: getDefaultCodecForFormat('mp4'),
        quality: 'high',
        resolution: { width: projectWidth, height: projectHeight },
      });
      resetState();
      setStartTime(null);
      setElapsedSeconds(0);
    }

    if (!open && wasOpenRef.current) {
      setView('settings');
      resetState();
      setStartTime(null);
      setElapsedSeconds(0);
    }

    wasOpenRef.current = open;
  }, [open, projectHeight, projectWidth, resetState]);

  const getAudioContainerOptions = () => [
    { value: 'mp3', label: 'MP3', description: t('dialogs.export.audioFormatMp3') },
    { value: 'aac', label: 'AAC', description: t('dialogs.export.audioFormatAac') },
    { value: 'wav', label: 'WAV', description: t('dialogs.export.audioFormatWav') },
  ];

  const VIDEO_CODEC_LABELS: Record<string, string> = {
    h264: 'H.264',
    h265: 'H.265/HEVC',
    vp8: 'VP8',
    vp9: 'VP9',
    av1: 'AV1',
  };

  const VIDEO_CONTAINER_DESCRIPTIONS: Record<ClientVideoContainer, string> = {
    mp4: t('dialogs.export.formatMp4'),
    mov: t('dialogs.export.formatMov'),
    webm: t('dialogs.export.formatWebm'),
    mkv: t('dialogs.export.formatMkv'),
  };

  useEffect(() => {
    if (!open || view !== 'settings' || exportMode !== 'video') return;

    let cancelled = false;
    setIsCheckingVideoSupport(true);
    setVideoSupportError(null);
    setSupportedVideoCodecs(null);

    void getSupportedCodecs({
      resolution: settings.resolution,
      quality: settings.quality,
    })
      .then((codecs) => {
        if (cancelled) return;
        setSupportedVideoCodecs(codecs);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t('dialogs.export.codecSupportError');
        setVideoSupportError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingVideoSupport(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    exportMode,
    getSupportedCodecs,
    open,
    settings.resolution.height,
    settings.resolution.width,
    settings.quality,
    view,
    t,
  ]);

  const videoContainerOptions = useMemo<VideoContainerOption[]>(() => {
    const allContainers: ClientVideoContainer[] = ['mp4', 'mov', 'webm', 'mkv'];

    return allContainers.map((container) => {
      const supported = supportedVideoCodecs === null
        ? true
        : getCompatibleVideoCodecs(container)
            .map((codec) => mapExportCodecToClientCodec(codec))
            .some((codec) => supportedVideoCodecs.includes(codec));

      return {
        value: container,
        label: container === 'mov' ? 'QuickTime (MOV)' : container.toUpperCase(),
        description: VIDEO_CONTAINER_DESCRIPTIONS[container],
        supported,
      };
    });
  }, [supportedVideoCodecs, VIDEO_CONTAINER_DESCRIPTIONS]);

  const codecOptions = useMemo<VideoCodecOption[]>(() => {
    return getCompatibleVideoCodecs(videoContainer).map((codec) => ({
      value: codec,
      label: VIDEO_CODEC_LABELS[codec],
      supported: supportedVideoCodecs === null
        ? true
        : supportedVideoCodecs.includes(mapExportCodecToClientCodec(codec)),
    }));
  }, [supportedVideoCodecs, videoContainer, VIDEO_CODEC_LABELS]);

  const hasCapabilityData = supportedVideoCodecs !== null && !videoSupportError;
  const hasSupportedVideoPath = videoContainerOptions.some((option) => option.supported);

  useEffect(() => {
    if (exportMode !== 'video' || !hasCapabilityData) return;

    const firstSupportedContainer = videoContainerOptions.find((option) => option.supported)?.value;
    if (!firstSupportedContainer) return;
    if (!videoContainerOptions.some((option) => option.value === videoContainer && option.supported)) {
      setVideoContainer(firstSupportedContainer);
    }
  }, [exportMode, hasCapabilityData, videoContainer, videoContainerOptions]);

  useEffect(() => {
    const validCodecs = codecOptions
      .filter((option) => option.supported)
      .map((option) => option.value);

    if (!validCodecs.includes(settings.codec)) {
      const fallbackCodec = validCodecs[0] ?? codecOptions[0]?.value;
      if (!fallbackCodec) return;
      setSettings((prev) => ({ ...prev, codec: fallbackCodec as ExportSettings['codec'] }));
    }
  }, [codecOptions, settings.codec]);

  const preventClose = view === 'progress' || view === 'complete';
  const fileSize = clientRender.result?.fileSize;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = clientRender.result?.blob;
    if (!blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [clientRender.result?.blob]);

  const isVideoResult = clientRender.result?.mimeType?.startsWith('video/') ?? false;

  const getTitle = () => {
    switch (view) {
      case 'settings':
        return t('dialogs.export.title');
      case 'progress':
        return (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {t('dialogs.export.exporting')}
          </span>
        );
      case 'complete':
        return (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {t('dialogs.export.exportComplete')}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {t('dialogs.export.exportFailed')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-2">
            <X className="h-5 w-5 text-muted-foreground" />
            {t('dialogs.export.exportCancelled')}
          </span>
        );
    }
  };

  const getDescription = () => {
    switch (view) {
      case 'settings':
        return t('dialogs.export.description');
      case 'progress':
        return t('dialogs.export.descriptionProgress');
      case 'complete':
        return t('dialogs.export.descriptionComplete');
      case 'error':
        return t('dialogs.export.descriptionFailed');
      case 'cancelled':
        return t('dialogs.export.descriptionCancelled');
    }
  };

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'low':
        return t('dialogs.export.low');
      case 'medium':
        return t('dialogs.export.medium');
      case 'high':
        return t('dialogs.export.high');
      case 'ultra':
        return t('dialogs.export.ultra');
      default:
        return quality;
    }
  };

  const getQualityDescription = (quality: string) => {
    switch (quality) {
      case 'low':
        return t('dialogs.export.qualityLow');
      case 'medium':
        return t('dialogs.export.qualityMedium');
      case 'high':
        return t('dialogs.export.qualityHigh');
      case 'ultra':
        return t('dialogs.export.qualityUltra');
      default:
        return '';
    }
  };

  const getAudioQualityLabel = (quality: string) => {
    switch (quality) {
      case 'low':
        return t('dialogs.export.audioQualityLow');
      case 'medium':
        return t('dialogs.export.audioQualityMedium');
      case 'high':
        return t('dialogs.export.audioQualityHigh');
      case 'ultra':
        return t('dialogs.export.audioQualityUltra');
      default:
        return quality;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'preparing':
        return t('dialogs.export.statusPreparing');
      case 'rendering':
        return t('dialogs.export.statusRendering');
      case 'encoding':
        return t('dialogs.export.statusEncoding');
      case 'finalizing':
        return t('dialogs.export.statusFinalizing');
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} modal>
      <DialogContent
        className={`overflow-hidden ${view === 'complete' && isVideoResult ? 'sm:max-w-[640px]' : 'sm:max-w-[500px]'}`}
        hideCloseButton={preventClose}
        onPointerDownOutside={(e) => preventClose && e.preventDefault()}
        onEscapeKeyDown={(e) => preventClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {view === 'settings' && (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('dialogs.export.exportType')}</Label>
              <div className="flex rounded-md border border-border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setExportMode('video')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                    exportMode === 'video'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  {t('dialogs.export.video')}
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode('audio')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                    exportMode === 'audio'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Music className="h-3.5 w-3.5" />
                  {t('dialogs.export.audio')}
                </button>
              </div>
            </div>

            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('dialogs.export.exportRange')}</span>
                </div>
                {hasInOutPoints && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="render-whole" className="text-xs text-muted-foreground">
                      {t('dialogs.export.renderWholeProject')}
                    </Label>
                    <Switch
                      id="render-whole"
                      checked={renderWholeProject}
                      onCheckedChange={setRenderWholeProject}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t('dialogs.export.in')}</div>
                  <div className="font-mono text-foreground">
                    {formatTimecode(exportRange.start, fps)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t('dialogs.export.out')}</div>
                  <div className="font-mono text-foreground">
                    {formatTimecode(exportRange.end, fps)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t('dialogs.export.duration')}</div>
                  <div className="font-mono text-foreground">
                    {formatTime(framesToSeconds(exportRange.duration, fps))}
                  </div>
                </div>
              </div>
              {hasInOutPoints && !renderWholeProject && (
                <p className="text-xs text-muted-foreground">
                  {t('dialogs.export.exportingInOutRange')}
                </p>
              )}
            </div>

            {exportMode === 'video' && (
              <>
                <div className="space-y-4">
                  {!isCheckingVideoSupport && videoSupportError && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {t('dialogs.export.codecSupportError')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isCheckingVideoSupport && !videoSupportError && !hasSupportedVideoPath && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {t('dialogs.export.noSupportedCodec', {
                          width: settings.resolution.width,
                          height: settings.resolution.height
                        })}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="container">{t('dialogs.export.format')}</Label>
                    <Select
                      value={videoContainer}
                      onValueChange={(v) => setVideoContainer(v as ClientVideoContainer)}
                    >
                      <SelectTrigger id="container">
                        <SelectValue placeholder={t('dialogs.export.selectFormat')} />
                      </SelectTrigger>
                      <SelectContent>
                        {videoContainerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={!option.supported}>
                            <span>{option.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codec">{t('dialogs.export.codec')}</Label>
                    <Select
                      value={settings.codec}
                      onValueChange={(value) => setSettings({ ...settings, codec: value as ExportSettings['codec'] })}
                    >
                      <SelectTrigger id="codec">
                        <SelectValue placeholder={t('dialogs.export.selectCodec')} />
                      </SelectTrigger>
                      <SelectContent>
                        {codecOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={!option.supported}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quality">{t('dialogs.export.quality')}</Label>
                    <Select
                      value={settings.quality}
                      onValueChange={(value) => setSettings({ ...settings, quality: value as ExportSettings['quality'] })}
                    >
                      <SelectTrigger id="quality">
                        <SelectValue placeholder={t('dialogs.export.quality')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          {getQualityLabel('low')}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {getQualityDescription('low')}
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">{getQualityLabel('medium')}</SelectItem>
                        <SelectItem value="high">
                          {getQualityLabel('high')}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {getQualityDescription('high')}
                          </span>
                        </SelectItem>
                        <SelectItem value="ultra">
                          {getQualityLabel('ultra')}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {getQualityDescription('ultra')}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution">{t('dialogs.export.resolution')}</Label>
                    <Select
                      value={`${settings.resolution.width}x${settings.resolution.height}`}
                      onValueChange={(value) => {
                        const parts = value.split('x').map(Number);
                        const width = parts[0] ?? projectWidth;
                        const height = parts[1] ?? projectHeight;
                        setSettings({ ...settings, resolution: { width, height } });
                      }}
                    >
                      <SelectTrigger id="resolution">
                        <SelectValue placeholder={t('dialogs.export.resolution')} />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {exportMode === 'audio' && (
              <div className="space-y-4">
                <Alert>
                  <Music className="h-4 w-4" />
                  <AlertDescription>
                    {t('dialogs.export.audioOnlyNote')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="audio-format">{t('dialogs.export.format')}</Label>
                  <Select
                    value={audioContainer}
                    onValueChange={(v) => setAudioContainer(v as ClientAudioContainer)}
                  >
                    <SelectTrigger id="audio-format">
                      <SelectValue placeholder={t('dialogs.export.selectFormat')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getAudioContainerOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span>{option.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{option.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audio-quality">{t('dialogs.export.quality')}</Label>
                  <Select
                    value={settings.quality}
                    onValueChange={(value) => setSettings({ ...settings, quality: value as ExportSettings['quality'] })}
                  >
                    <SelectTrigger id="audio-quality">
                      <SelectValue placeholder={t('dialogs.export.quality')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{getAudioQualityLabel('low')}</SelectItem>
                      <SelectItem value="medium">{getAudioQualityLabel('medium')}</SelectItem>
                      <SelectItem value="high">{getAudioQualityLabel('high')}</SelectItem>
                      <SelectItem value="ultra">{getAudioQualityLabel('ultra')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('dialogs.export.cancel')}
              </Button>
              <Button
                onClick={handleStartExport}
                disabled={exportMode === 'video' && (!hasSupportedVideoPath || isCheckingVideoSupport)}
              >
                {exportMode === 'audio' ? t('dialogs.export.exportAudio') : t('dialogs.export.startExport')}
              </Button>
            </div>
          </div>
        )}

        {view === 'progress' && (
          <div className="space-y-4 py-4 overflow-hidden">
            <div className="space-y-4 min-w-0">
              <div className="space-y-2 min-w-0">
                <div className="w-full overflow-hidden">
                  <Progress value={progress} className="h-2 w-full" />
                </div>
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="text-muted-foreground truncate">
                    {getStatusLabel()}
                  </span>
                  <span className="font-medium tabular-nums flex-shrink-0">{Math.round(progress)}%</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {renderedFrames !== undefined && totalFrames !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{t('dialogs.export.frames')}:</span>
                    <span className="font-medium tabular-nums">{renderedFrames}/{totalFrames}</span>
                  </div>
                )}
                {elapsedSeconds > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{t('dialogs.export.elapsed')}</span>
                    <span className="font-medium tabular-nums">{formatTime(elapsedSeconds)}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {t('dialogs.export.keepTabOpen')}
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={cancelExport}>
                {t('dialogs.export.cancelExport')}
              </Button>
            </div>
          </div>
        )}

        {view === 'complete' && (
          <div className="space-y-4 py-4">
            {previewUrl && (
              <ExportPreviewPlayer src={previewUrl} isVideo={isVideoResult} />
            )}

            <Alert className="border-green-900 bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-400">
                {exportMode === 'audio'
                  ? t('dialogs.export.audioExportedSuccess')
                  : t('dialogs.export.videoExportedSuccess')}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {fileSize && (
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('dialogs.export.estimatedSize')}:</span>
                  <span className="font-medium">{formatFileSize(fileSize)}</span>
                </div>
              )}
              {elapsedSeconds > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('dialogs.export.timeTaken')}:</span>
                  <span className="font-medium">{formatTime(elapsedSeconds)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('dialogs.export.close')}
              </Button>
              <Button onClick={downloadVideo}>
                <Download className="mr-2 h-4 w-4" />
                {t('dialogs.export.download')}
              </Button>
            </div>
          </div>
        )}

        {view === 'error' && (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                {t('dialogs.export.close')}
              </Button>
            </div>
          </div>
        )}

        {view === 'cancelled' && (
          <div className="space-y-4 py-4">
            <Alert>
              <X className="h-4 w-4" />
              <AlertDescription>{t('dialogs.export.exportCancelledMessage')}</AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                {t('dialogs.export.close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
