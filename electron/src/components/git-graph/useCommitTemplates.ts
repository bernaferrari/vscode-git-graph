import { useEffect, useState } from 'react';
import type { CommitTemplate } from './commit-templates';

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

const STORAGE_KEY = 'git-graph-commit-templates';

export function useCommitTemplates() {
    const [templates, setTemplates] = useState<CommitTemplate[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setTemplates(JSON.parse(stored));
            } catch {
                setTemplates(DEFAULT_TEMPLATES);
            }
        } else {
            setTemplates(DEFAULT_TEMPLATES);
        }
    }, []);

    useEffect(() => {
        if (templates.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
        }
    }, [templates]);

    const addTemplate = (template: Omit<CommitTemplate, 'id'>) => {
        const newTemplate: CommitTemplate = {
            ...template,
            id: Date.now().toString(),
        };
        setTemplates((prev) => [...prev, newTemplate]);
    };

    const updateTemplate = (id: string, updates: Partial<CommitTemplate>) => {
        setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    };

    const deleteTemplate = (id: string) => {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
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
        setTemplates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        duplicateTemplate,
    };
}
