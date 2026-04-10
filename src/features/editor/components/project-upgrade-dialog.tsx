import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProjectUpgradeDialogProps {
  backupName: string;
  currentSchemaVersion: number;
  isUpgrading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  projectName: string;
  storedSchemaVersion: number;
}

export function ProjectUpgradeDialog({
  backupName,
  currentSchemaVersion,
  isUpgrading,
  onCancel,
  onConfirm,
  open,
  projectName,
  storedSchemaVersion,
}: ProjectUpgradeDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !isUpgrading) {
        onCancel();
      }
    }}>
      <DialogContent
        className="max-w-lg"
        hideCloseButton
        onEscapeKeyDown={(event) => {
          if (isUpgrading) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('dialogs.projectUpgrade.title')}
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-1">
            <span className="block">
              {t('dialogs.projectUpgrade.description1', { 
                projectName, 
                storedVersion: storedSchemaVersion, 
                currentVersion: currentSchemaVersion 
              })}
            </span>
            <span className="block">
              {t('dialogs.projectUpgrade.description2')}
            </span>
            <span className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {t('dialogs.projectUpgrade.backupCopy')} <strong>{backupName}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isUpgrading}
          >
            {t('dialogs.projectUpgrade.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isUpgrading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isUpgrading ? 'animate-spin' : ''}`} />
            {isUpgrading ? t('dialogs.projectUpgrade.creatingBackup') : t('dialogs.projectUpgrade.createBackupUpgrade')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
