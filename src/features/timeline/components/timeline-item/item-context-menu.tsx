import { memo, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useSelectionStore } from '@/shared/state/selection';
import { PROPERTY_LABELS, type AnimatableProperty } from '@/types/keyframe';
import type { PropertyKeyframes } from '@/types/keyframe';
import type { MediaTranscriptModel } from '@/types/storage';
import {
  WHISPER_MODEL_LABELS,
  WHISPER_MODEL_OPTIONS,
} from '@/shared/utils/whisper-settings';
import { formatHotkeyBinding } from '@/config/hotkeys';
import { useResolvedHotkeys } from '@/features/timeline/deps/settings';

interface ItemContextMenuProps {
  children: ReactNode;
  trackLocked: boolean;
  isSelected: boolean;
  canJoinSelected: boolean;
  hasJoinableLeft: boolean;
  hasJoinableRight: boolean;
  /** Which edge was closer when context menu was triggered */
  closerEdge: 'left' | 'right' | null;
  /** Keyframed properties for the item (used to build clear submenu) */
  keyframedProperties?: PropertyKeyframes[];
  canLinkSelected?: boolean;
  canUnlinkSelected?: boolean;
  onJoinSelected: () => void;
  onJoinLeft: () => void;
  onJoinRight: () => void;
  onLinkSelected?: () => void;
  onUnlinkSelected?: () => void;
  onRippleDelete: () => void;
  onDelete: () => void;
  onClearAllKeyframes?: () => void;
  onClearPropertyKeyframes?: (property: AnimatableProperty) => void;
  onBentoLayout?: () => void;
  /** Whether this item is a video clip (enables freeze frame option) */
  isVideoItem?: boolean;
  /** Whether the playhead is within this item's bounds */
  playheadInBounds?: boolean;
  onFreezeFrame?: () => void;
  canGenerateCaptions?: boolean;
  canRegenerateCaptions?: boolean;
  isGeneratingCaptions?: boolean;
  defaultCaptionModel?: MediaTranscriptModel;
  onGenerateCaptions?: (model: MediaTranscriptModel) => void;
  onRegenerateCaptions?: (model: MediaTranscriptModel) => void;
  /** Whether this item is a composition item (enables enter/dissolve options) */
  isCompositionItem?: boolean;
  onEnterComposition?: () => void;
  onDissolveComposition?: () => void;
  /** Whether multiple items are selected (enables pre-comp creation) */
  canCreatePreComp?: boolean;
  onCreatePreComp?: () => void;
  /** Whether this item is a text item (enables generate audio option) */
  isTextItem?: boolean;
  onGenerateAudioFromText?: () => void;
  /** Whether scene detection is available for this item */
  canDetectScenes?: boolean;
  isDetectingScenes?: boolean;
  onDetectScenes?: () => void;
}

/**
 * Context menu for timeline items
 * Provides delete, ripple delete, join, and keyframe clearing operations
 */
export const ItemContextMenu = memo(function ItemContextMenu({
  children,
  trackLocked,
  isSelected,
  canJoinSelected,
  hasJoinableLeft,
  hasJoinableRight,
  closerEdge,
  keyframedProperties,
  canLinkSelected,
  canUnlinkSelected,
  onJoinSelected,
  onJoinLeft,
  onJoinRight,
  onLinkSelected,
  onUnlinkSelected,
  onRippleDelete,
  onDelete,
  onClearAllKeyframes,
  onClearPropertyKeyframes,
  onBentoLayout,
  isVideoItem,
  playheadInBounds,
  onFreezeFrame,
  canGenerateCaptions,
  canRegenerateCaptions,
  isGeneratingCaptions,
  defaultCaptionModel,
  onGenerateCaptions,
  onRegenerateCaptions,
  isCompositionItem,
  onEnterComposition,
  onDissolveComposition,
  canCreatePreComp,
  onCreatePreComp,
  isTextItem,
  onGenerateAudioFromText,
  // canDetectScenes, isDetectingScenes, onDetectScenes — disabled pending optical flow tuning
}: ItemContextMenuProps) {
  const { t } = useTranslation();
  const hotkeys = useResolvedHotkeys();
  const selectedCount = useSelectionStore((s) => s.selectedItemIds.length);
  // Filter to only properties that actually have keyframes
  const propertiesWithKeyframes = useMemo(() => {
    if (!keyframedProperties) return [];
    return keyframedProperties.filter(p => p.keyframes.length > 0);
  }, [keyframedProperties]);
  const explicitCaptionModelOptions = useMemo(
    () => WHISPER_MODEL_OPTIONS.filter((option) => option.value !== defaultCaptionModel),
    [defaultCaptionModel]
  );

  const hasKeyframes = propertiesWithKeyframes.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={trackLocked}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {/* Join options - show based on which edge is closer */}
        {(() => {
          // Determine which join option to show based on closer edge
          const showJoinLeft = hasJoinableLeft && (closerEdge === 'left' || !hasJoinableRight);
          const showJoinRight = hasJoinableRight && (closerEdge === 'right' || !hasJoinableLeft);
          const hasJoinOption = showJoinLeft || showJoinRight || canJoinSelected;

          if (!hasJoinOption) return null;

          return (
            <>
              {showJoinLeft && (
                <ContextMenuItem onClick={onJoinLeft}>
                  {t('contextMenu.joinWithPrevious')}
                  <ContextMenuShortcut>J</ContextMenuShortcut>
                </ContextMenuItem>
              )}
              {showJoinRight && (
                <ContextMenuItem onClick={onJoinRight}>
                  {t('contextMenu.joinWithNext')}
                  <ContextMenuShortcut>J</ContextMenuShortcut>
                </ContextMenuItem>
              )}
              {canJoinSelected && (
                <ContextMenuItem onClick={onJoinSelected}>
                  {t('contextMenu.joinSelected')}
                  <ContextMenuShortcut>J</ContextMenuShortcut>
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          );
        })()}

        {(canLinkSelected || canUnlinkSelected) && (
          <>
            {canLinkSelected && onLinkSelected && (
              <ContextMenuItem onClick={onLinkSelected}>
                {t('contextMenu.linkClips')}
                <ContextMenuShortcut>{formatHotkeyBinding(hotkeys.LINK_AUDIO_VIDEO)}</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {canUnlinkSelected && onUnlinkSelected && (
              <ContextMenuItem onClick={onUnlinkSelected}>
                {t('contextMenu.unlinkClips')}
                <ContextMenuShortcut>{formatHotkeyBinding(hotkeys.UNLINK_AUDIO_VIDEO)}</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}

        {/* Clear Keyframes submenu - only show if item has keyframes */}
        {hasKeyframes && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>{t('contextMenu.clearKeyframes')}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem onClick={onClearAllKeyframes}>
                  {t('contextMenu.clearAll')}
                  <ContextMenuShortcut>{formatHotkeyBinding(hotkeys.CLEAR_KEYFRAMES)}</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                {propertiesWithKeyframes.map(({ property }) => (
                  <ContextMenuItem
                    key={property}
                    onClick={() => onClearPropertyKeyframes?.(property)}
                  >
                    {PROPERTY_LABELS[property]}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
          </>
        )}

        {/* Bento Layout - only show when 2+ items selected */}
        {selectedCount >= 2 && onBentoLayout && (
          <>
            <ContextMenuItem onClick={onBentoLayout}>
              {t('contextMenu.bentoLayout')}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Freeze Frame - only show for video items when playhead is within bounds */}
        {isVideoItem && playheadInBounds && onFreezeFrame && (
          <>
            <ContextMenuItem onClick={onFreezeFrame}>
              {t('contextMenu.insertFreezeFrame')}
              <ContextMenuShortcut>Shift+F</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Detect Scenes - disabled pending optical flow tuning */}
        {/* {canDetectScenes && onDetectScenes && (
          <>
            {isDetectingScenes ? (
              <ContextMenuItem disabled>
                Detecting Scenes...
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onClick={onDetectScenes}>
                Detect Scenes &amp; Split
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )} */}

        {/* Generate Audio from Text - only show for text items */}
        {isTextItem && onGenerateAudioFromText && (
          <>
            <ContextMenuItem onClick={onGenerateAudioFromText}>
              {t('contextMenu.generateAudioFromText')}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {canGenerateCaptions && onGenerateCaptions && (
          <>
            {isGeneratingCaptions ? (
              <ContextMenuItem disabled>
                {t('contextMenu.updatingCaptions')}
              </ContextMenuItem>
            ) : (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>{t('contextMenu.generateCaptionsForSegment')}</ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    {defaultCaptionModel && (
                      <>
                        <ContextMenuItem onClick={() => onGenerateCaptions(defaultCaptionModel)}>
                          {`${t('contextMenu.default')} (${WHISPER_MODEL_LABELS[defaultCaptionModel]})`}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                      </>
                    )}
                    {explicitCaptionModelOptions.map((option) => (
                      <ContextMenuItem
                        key={option.value}
                        onClick={() => onGenerateCaptions(option.value)}
                      >
                        {option.label}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>

                {canRegenerateCaptions && onRegenerateCaptions && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>{t('contextMenu.regenerateCaptionsForSegment')}</ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      {defaultCaptionModel && (
                        <>
                          <ContextMenuItem onClick={() => onRegenerateCaptions(defaultCaptionModel)}>
                            {`${t('contextMenu.default')} (${WHISPER_MODEL_LABELS[defaultCaptionModel]})`}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      )}
                      {explicitCaptionModelOptions.map((option) => (
                        <ContextMenuItem
                          key={option.value}
                          onClick={() => onRegenerateCaptions(option.value)}
                        >
                          {option.label}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
              </>
            )}
            <ContextMenuSeparator />
          </>
        )}

        {/* Composition operations */}
        {isCompositionItem && onEnterComposition && (
          <ContextMenuItem onClick={onEnterComposition}>
            {t('contextMenu.openCompoundClip')}
          </ContextMenuItem>
        )}
        {isCompositionItem && onDissolveComposition && (
          <ContextMenuItem onClick={onDissolveComposition}>
            {t('contextMenu.dissolveCompoundClip')}
          </ContextMenuItem>
        )}
        {canCreatePreComp && onCreatePreComp && (
          <ContextMenuItem onClick={onCreatePreComp}>
            {t('contextMenu.createCompoundClip')}
          </ContextMenuItem>
        )}
        {((isCompositionItem && (onEnterComposition || onDissolveComposition)) || (canCreatePreComp && onCreatePreComp)) && (
          <ContextMenuSeparator />
        )}

        <ContextMenuItem
          onClick={onRippleDelete}
          disabled={!isSelected}
          className="text-destructive focus:text-destructive"
        >
          {t('contextMenu.rippleDelete')}
          <ContextMenuShortcut>Ctrl+Del</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          disabled={!isSelected}
          className="text-destructive focus:text-destructive"
        >
          {t('contextMenu.delete')}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
