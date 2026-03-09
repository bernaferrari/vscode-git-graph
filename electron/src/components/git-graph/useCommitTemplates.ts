import { useEffect, useState } from 'react';
import type { CommitTemplate } from './commit-templates';
import { trpc } from '@/trpc/client';

const DEFAULT_TEMPLATES: CommitTemplate[] = [
    {
        id: 'feat',
        name: 'Feature',
        description: 'New feature',
        content: 'feat: \n\n',
        isDefault: true,
    },
    {
        id: 'fix',
        name: 'Bug Fix',
        description: 'Bug fix',
        content: 'fix: \n\n',
        isDefault: true,
    },
    {
        id: 'docs',
        name: 'Documentation',
        description: 'Documentation changes',
        content: 'docs: \n\n',
        isDefault: true,
    },
    {
        id: 'refactor',
        name: 'Refactor',
        description: 'Code refactoring',
        content: 'refactor: \n\n',
        isDefault: true,
    },
    {
        id: 'test',
        name: 'Test',
        description: 'Adding tests',
        content: 'test: \n\n',
        isDefault: true,
    },
    {
        id: 'chore',
        name: 'Chore',
        description: 'Maintenance tasks',
        content: 'chore: \n\n',
        isDefault: true,
    },
];
export function useCommitTemplates() {
    const [templates, setTemplates] = useState<CommitTemplate[]>([]);
    const utils = trpc.useUtils();
    const templatesQuery = trpc.config.commitTemplates.useQuery(undefined, { staleTime: 10_000 });
    const setTemplatesMutation = trpc.config.setCommitTemplates.useMutation({
        onSuccess: async () => {
            await utils.config.commitTemplates.invalidate();
        },
    });

    useEffect(() => {
        const stored = templatesQuery.data?.templates;
        if (stored && stored.length > 0) {
            setTemplates(stored);
        } else if (templatesQuery.isSuccess) {
            setTemplates(DEFAULT_TEMPLATES);
        }
    }, [templatesQuery.data?.templates, templatesQuery.isSuccess]);

    const persistTemplates = (nextTemplates: CommitTemplate[]) => {
        setTemplates(nextTemplates);
        setTemplatesMutation.mutate({ templates: nextTemplates });
    };

    const addTemplate = (template: Omit<CommitTemplate, 'id'>) => {
        const newTemplate: CommitTemplate = {
            ...template,
            id: Date.now().toString(),
        };
        persistTemplates([...templates, newTemplate]);
    };

    const updateTemplate = (id: string, updates: Partial<CommitTemplate>) => {
        persistTemplates(templates.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    };

    const deleteTemplate = (id: string) => {
        persistTemplates(templates.filter((t) => t.id !== id));
    };

    const duplicateTemplate = (id: string) => {
        const template = templates.find((t) => t.id === id);
        if (template) {
            addTemplate({
                ...template,
                name: `${template.name} (Copy)`,
                isDefault: false,
            });
        }
    };

    return {
        templates,
        setTemplates: persistTemplates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        duplicateTemplate,
    };
}
