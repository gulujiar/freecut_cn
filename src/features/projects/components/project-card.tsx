import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MoreVertical, PlayCircle, Edit2, Copy, Trash2, AlertTriangle, HardDrive } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Button } from '@/components/ui/button';
import type { Project } from '@/types/project';
import { formatRelativeTime } from '../utils/project-helpers';
import { useDeleteProject, useDuplicateProject } from '../hooks/use-project-actions';
import { useProjectThumbnail } from '../hooks/use-project-thumbnail';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clearLocalFiles, setClearLocalFiles] = useState(false);
  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();
  const thumbnailUrl = useProjectThumbnail(project);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setShowDeleteDialog(false);
    const wantedLocalDelete = clearLocalFiles;
    const result = await deleteProject(project.id, clearLocalFiles);
    setIsDeleting(false);
    setClearLocalFiles(false);

    if (!result.success) {
      toast.error(t('projects.failedDeleteProject'), { description: result.error });
    } else if (wantedLocalDelete && !result.localFilesDeleted) {
      toast.warning(t('projects.projectDeletedNotFiles'), {
        description: t('projects.filesystemCleanupFailed'),
      });
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDuplicating(true);
    const result = await duplicateProject(project.id);
    setIsDuplicating(false);

    if (!result.success) {
      toast.error(t('projects.failedDuplicateProject'), { description: result.error });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(project);
  };

  // Safe metadata access with defaults
  const width = project?.metadata?.width || 1920;
  const height = project?.metadata?.height || 1080;
  const fps = project?.metadata?.fps || 30;

  const resolution = `${width}×${height}`;
  const aspectRatio = width / height;
  const aspectRatioLabel =
    Math.abs(aspectRatio - 16 / 9) < 0.01
      ? '16:9'
      : Math.abs(aspectRatio - 4 / 3) < 0.01
        ? '4:3'
        : Math.abs(aspectRatio - 1) < 0.01
          ? '1:1'
          : Math.abs(aspectRatio - 21 / 9) < 0.01
            ? '21:9'
            : `${width}:${height}`;

  return (
    <div className="group relative panel-bg border border-border rounded-lg overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      {/* Thumbnail */}
      <Link
        to="/editor/$projectId"
        params={{ projectId: project.id }}
        className="block relative aspect-video bg-secondary/30 overflow-hidden"
      >
        {thumbnailUrl ? (
          <img
            key={project.updatedAt} // Force re-render when project is updated
            src={thumbnailUrl}
            alt={project.name}
            className="w-full h-full object-contain bg-black/40"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/40 to-secondary/20">
            <PlayCircle className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center gap-2 text-white">
            <PlayCircle className="w-6 h-6" />
            <span className="font-medium">{t('projects.openInEditor')}</span>
          </div>
        </div>

        {/* Resolution badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-mono text-white">
          {resolution}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {project.description}
              </p>
            )}
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link
                  to="/editor/$projectId"
                  params={{ projectId: project.id }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <PlayCircle className="w-4 h-4" />
                  打开
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                修改
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {isDuplicating ? t('projects.duplicating') : t('projects.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? t('projects.deleting') : t('projects.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setClearLocalFiles(false);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t('projects.deleteProject')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('projects.confirmDelete')} <strong>{project.name}</strong>{t('projects.confirmDeleteSuffix')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {project.rootFolderHandle && (
              <label className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border border-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={clearLocalFiles}
                  onChange={(e) => setClearLocalFiles(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-destructive"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('projects.alsoDeleteLocal')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('projects.removeFilesFrom')}{project.rootFolderName ? ` "${project.rootFolderName}"` : ''}{t('projects.removeFilesSuffix')}
                  </p>
                </div>
              </label>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('projects.deleteProject')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-mono">{aspectRatioLabel}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <div className="flex items-center gap-1.5">
            <span className="font-mono">{fps}fps</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <div className="flex items-center gap-1.5">
            <span>{formatRelativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
