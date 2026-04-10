import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/shared/logging/logger';
import { useTranslation } from 'react-i18next';
import { ProjectForm } from '@/features/projects/components/project-form';
import { useCreateProject } from '@/features/projects/hooks/use-project-actions';
import { useProjectStore } from '@/features/projects/stores/project-store';
import { EditorLogo } from '@/components/brand/freecut-logo';
import type { ProjectFormData } from '@/features/projects/utils/validation';

const logger = createLogger('NewProject');

export const Route = createFileRoute('/projects/new')({
  component: NewProject,
  beforeLoad: async () => {
    try {
      const { loadProjects } = useProjectStore.getState();
      await loadProjects();
    } catch (err) {
      logger.warn('Failed to pre-load projects in beforeLoad:', err);
    }
  },
});

function NewProject() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createProject = useCreateProject();

  const handleSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);

    try {
      const result = await createProject(data);

      if (result.success && result.project) {
        // Navigate to editor with new project
        navigate({
          to: '/editor/$projectId',
          params: { projectId: result.project.id },
        });
      } else {
        toast.error(t('projects.failedCreateProject'), { description: result.error });
        setIsSubmitting(false);
      }
    } catch (error) {
      logger.error('Failed to create project:', error);
      toast.error(t('projects.failedCreateProject'), { description: t('projects.pleaseTryAgain') });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="panel-header border-b border-border">
        <div className="max-w-[1920px] mx-auto px-6 py-5 flex items-center">
          <Link to="/">
            <EditorLogo size="md" className="hover:opacity-80 transition-opacity" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1920px] mx-auto">
        <ProjectForm onSubmit={handleSubmit} isSubmitting={isSubmitting} hideHeader={true} />
      </div>
    </div>
  );
}

