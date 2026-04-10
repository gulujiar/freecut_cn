import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTimelineStore } from '@/features/editor/deps/timeline-store';
import { PROPERTY_LABELS } from '@/types/keyframe';
import { useClearKeyframesDialogStore } from '@/shared/state/clear-keyframes-dialog';
import { useTranslation } from 'react-i18next';

/**
 * Confirmation dialog for clearing keyframes from selected items.
 * Triggered by Shift+A hotkey or context menu actions.
 */
export function ClearKeyframesDialog() {
  const { t } = useTranslation();
  const isOpen = useClearKeyframesDialogStore((s) => s.isOpen);
  const itemIds = useClearKeyframesDialogStore((s) => s.itemIds);
  const property = useClearKeyframesDialogStore((s) => s.property);
  const close = useClearKeyframesDialogStore((s) => s.close);

  const handleConfirm = () => {
    if (property) {
      // Clear keyframes for specific property
      const removeKeyframesForProperty = useTimelineStore.getState().removeKeyframesForProperty;
      for (const itemId of itemIds) {
        removeKeyframesForProperty(itemId, property);
      }
    } else {
      // Clear all keyframes
      const removeKeyframesForItem = useTimelineStore.getState().removeKeyframesForItem;
      for (const itemId of itemIds) {
        removeKeyframesForItem(itemId);
      }
    }
    close();
  };

  const itemCount = itemIds.length;
  const itemText = itemCount === 1 ? 'clip' : 'clips';
  const propertyLabel = property ? PROPERTY_LABELS[property] : null;

  const title = property 
    ? t('dialogs.clearKeyframes.titleProperty', { property: propertyLabel }) 
    : t('dialogs.clearKeyframes.titleAll');
  const description = property
    ? t('dialogs.clearKeyframes.descriptionProperty', { property: propertyLabel, count: itemCount })
    : t('dialogs.clearKeyframes.descriptionAll', { count: itemCount });

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            <br />
            <span className="text-muted-foreground text-xs mt-1 block">
              {t('dialogs.clearKeyframes.canUndo')}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('dialogs.clearKeyframes.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {t('dialogs.clearKeyframes.clear')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
