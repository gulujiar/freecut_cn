import type { HotkeyKey } from '@/config/hotkeys';

export interface HotkeyEditorItem {
  labelKey: string;
  keys: readonly HotkeyKey[];
}

export interface HotkeyEditorSection {
  titleKey: string;
  blurbKey: string;
  items: readonly HotkeyEditorItem[];
}

export const HOTKEY_EDITOR_SECTIONS: readonly HotkeyEditorSection[] = [
  {
    titleKey: 'hotkeys.sectionPlayback',
    blurbKey: 'hotkeys.sectionPlaybackBlurb',
    items: [
      { labelKey: 'hotkeys.playPause', keys: ['PLAY_PAUSE'] },
      { labelKey: 'hotkeys.previousFrame', keys: ['PREVIOUS_FRAME'] },
      { labelKey: 'hotkeys.nextFrame', keys: ['NEXT_FRAME'] },
      { labelKey: 'hotkeys.goToStart', keys: ['GO_TO_START'] },
      { labelKey: 'hotkeys.goToEnd', keys: ['GO_TO_END'] },
      { labelKey: 'hotkeys.previousSnapPoint', keys: ['PREVIOUS_SNAP_POINT'] },
      { labelKey: 'hotkeys.nextSnapPoint', keys: ['NEXT_SNAP_POINT'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionEditing',
    blurbKey: 'hotkeys.sectionEditingBlurb',
    items: [
      { labelKey: 'hotkeys.splitAtPlayhead', keys: ['SPLIT_AT_PLAYHEAD'] },
      { labelKey: 'hotkeys.joinSelectedClips', keys: ['JOIN_ITEMS'] },
      { labelKey: 'hotkeys.deleteSelectedItems', keys: ['DELETE_SELECTED', 'DELETE_SELECTED_ALT'] },
      { labelKey: 'hotkeys.rippleDeleteSelectedItems', keys: ['RIPPLE_DELETE', 'RIPPLE_DELETE_ALT'] },
      { labelKey: 'hotkeys.insertFreezeFrame', keys: ['FREEZE_FRAME'] },
      { labelKey: 'hotkeys.linkSelectedClips', keys: ['LINK_AUDIO_VIDEO'] },
      { labelKey: 'hotkeys.unlinkSelectedClips', keys: ['UNLINK_AUDIO_VIDEO'] },
      { labelKey: 'hotkeys.toggleLinkedSelection', keys: ['TOGGLE_LINKED_SELECTION'] },
      { labelKey: 'hotkeys.nudge1px', keys: ['NUDGE_LEFT', 'NUDGE_RIGHT', 'NUDGE_UP', 'NUDGE_DOWN'] },
      { labelKey: 'hotkeys.nudge10px', keys: ['NUDGE_LEFT_LARGE', 'NUDGE_RIGHT_LARGE', 'NUDGE_UP_LARGE', 'NUDGE_DOWN_LARGE'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionTools',
    blurbKey: 'hotkeys.sectionToolsBlurb',
    items: [
      { labelKey: 'hotkeys.selectionTool', keys: ['SELECTION_TOOL'] },
      { labelKey: 'hotkeys.trimEditTool', keys: ['TRIM_EDIT_TOOL'] },
      { labelKey: 'hotkeys.razorTool', keys: ['RAZOR_TOOL'] },
      { labelKey: 'hotkeys.splitAtCursor', keys: ['SPLIT_AT_CURSOR'] },
      { labelKey: 'hotkeys.rateStretchTool', keys: ['RATE_STRETCH_TOOL'] },
      { labelKey: 'hotkeys.slipTool', keys: ['SLIP_TOOL'] },
      { labelKey: 'hotkeys.slideTool', keys: ['SLIDE_TOOL'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionHistoryUI',
    blurbKey: 'hotkeys.sectionHistoryUIBlurb',
    items: [
      { labelKey: 'hotkeys.undo', keys: ['UNDO'] },
      { labelKey: 'hotkeys.redo', keys: ['REDO'] },
      { labelKey: 'hotkeys.zoomIn', keys: ['ZOOM_IN'] },
      { labelKey: 'hotkeys.zoomOut', keys: ['ZOOM_OUT'] },
      { labelKey: 'hotkeys.zoomToFit', keys: ['ZOOM_TO_FIT'] },
      { labelKey: 'hotkeys.zoomTo100', keys: ['ZOOM_TO_100', 'ZOOM_TO_100_ALT'] },
      { labelKey: 'hotkeys.toggleSnap', keys: ['TOGGLE_SNAP'] },
      { labelKey: 'hotkeys.toggleKeyframeEditor', keys: ['TOGGLE_KEYFRAME_EDITOR'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionClipboard',
    blurbKey: 'hotkeys.sectionClipboardBlurb',
    items: [
      { labelKey: 'hotkeys.copy', keys: ['COPY'] },
      { labelKey: 'hotkeys.cut', keys: ['CUT'] },
      { labelKey: 'hotkeys.paste', keys: ['PASTE'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionMarkers',
    blurbKey: 'hotkeys.sectionMarkersBlurb',
    items: [
      { labelKey: 'hotkeys.addMarker', keys: ['ADD_MARKER'] },
      { labelKey: 'hotkeys.removeMarker', keys: ['REMOVE_MARKER'] },
      { labelKey: 'hotkeys.previousMarker', keys: ['PREVIOUS_MARKER'] },
      { labelKey: 'hotkeys.nextMarker', keys: ['NEXT_MARKER'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionKeyframes',
    blurbKey: 'hotkeys.sectionKeyframesBlurb',
    items: [
      { labelKey: 'hotkeys.clearKeyframes', keys: ['CLEAR_KEYFRAMES'] },
      { labelKey: 'hotkeys.keyframeEditorGraph', keys: ['KEYFRAME_EDITOR_GRAPH'] },
      { labelKey: 'hotkeys.keyframeEditorDopesheet', keys: ['KEYFRAME_EDITOR_DOPESHEET'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionSourceMonitor',
    blurbKey: 'hotkeys.sectionSourceMonitorBlurb',
    items: [
      { labelKey: 'hotkeys.markIn', keys: ['MARK_IN'] },
      { labelKey: 'hotkeys.markOut', keys: ['MARK_OUT'] },
      { labelKey: 'hotkeys.clearInOut', keys: ['CLEAR_IN_OUT'] },
      { labelKey: 'hotkeys.insertEdit', keys: ['INSERT_EDIT'] },
      { labelKey: 'hotkeys.overwriteEdit', keys: ['OVERWRITE_EDIT'] },
    ],
  },
  {
    titleKey: 'hotkeys.sectionProject',
    blurbKey: 'hotkeys.sectionProjectBlurb',
    items: [
      { labelKey: 'hotkeys.saveProject', keys: ['SAVE'] },
      { labelKey: 'hotkeys.exportVideo', keys: ['EXPORT'] },
    ],
  },
] as const;
