/**
 * Commit Templates
 * Predefined commit message templates for consistency
 */

import { Plus, Trash2, Edit, Copy, FileText, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

export interface CommitTemplate {
    id: string;
    name: string;
    description?: string;
    content: string;
    isDefault?: boolean;
}

interface CommitTemplatesProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect?: (template: CommitTemplate) => void;
    templates: CommitTemplate[];
    onTemplatesChange: (templates: CommitTemplate[]) => void;
}

export function CommitTemplatesDialog({
    open,
    onOpenChange,
    onSelect,
    templates,
    onTemplatesChange,
}: CommitTemplatesProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<CommitTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTemplate, setNewTemplate] = useState<Omit<CommitTemplate, 'id'>>({
        name: '',
        description: '',
        content: '',
    });

    const filteredTemplates = templates.filter(
        (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (template: CommitTemplate) => {
        onSelect?.(template);
        onOpenChange(false);
    };

    const handleSaveNew = () => {
        if (!newTemplate.name || !newTemplate.content) return;
        const newId = Date.now().toString();
        onTemplatesChange([...templates, { ...newTemplate, id: newId }]);
        setNewTemplate({ name: '', description: '', content: '' });
        setIsCreating(false);
    };

    const handleUpdate = () => {
        if (!editingTemplate) return;
        onTemplatesChange(templates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)));
        setEditingTemplate(null);
    };

    const handleDelete = (id: string) => {
        onTemplatesChange(templates.filter((t) => t.id !== id));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[85vh] max-w-2xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <FileText className='h-5 w-5' />
                        Commit Templates
                    </DialogTitle>
                </DialogHeader>

                <div className='flex items-center gap-2 py-2'>
                    <div className='relative flex-1'>
                        <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
                        <Input
                            placeholder='Search templates...'
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); }}
                            className='pl-8'
                        />
                    </div>
                    <Button variant='outline' size='sm' onClick={() => { setIsCreating(true); }}>
                        <Plus className='mr-1 h-4 w-4' />
                        New
                    </Button>
                </div>

                <ScrollArea className='flex-1'>
                    {isCreating && (
                        <div className='bg-muted/30 mb-4 rounded-lg border p-4'>
                            <h4 className='mb-3 font-medium'>New Template</h4>
                            <div className='space-y-3'>
                                <Input
                                    placeholder='Template name'
                                    value={newTemplate.name}
                                    onChange={(e) => { setNewTemplate((prev) => ({ ...prev, name: e.target.value })); }}
                                />
                                <Input
                                    placeholder='Description (optional)'
                                    value={newTemplate.description ?? ''}
                                    onChange={(e) =>
                                        { setNewTemplate((prev) => ({ ...prev, description: e.target.value })); }
                                    }
                                />
                                <Textarea
                                    placeholder='Template content (use {description} as placeholder)'
                                    value={newTemplate.content}
                                    onChange={(e) => { setNewTemplate((prev) => ({ ...prev, content: e.target.value })); }}
                                    className='min-h-[100px] font-mono text-sm'
                                />
                                <div className='flex justify-end gap-2'>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        onClick={() => {
                                            setIsCreating(false);
                                            setNewTemplate({ name: '', description: '', content: '' });
                                        }}>
                                        Cancel
                                    </Button>
                                    <Button size='sm' onClick={handleSaveNew}>
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {editingTemplate && (
                        <div className='bg-muted/30 mb-4 rounded-lg border p-4'>
                            <h4 className='mb-3 font-medium'>Edit Template</h4>
                            <div className='space-y-3'>
                                <Input
                                    placeholder='Template name'
                                    value={editingTemplate.name}
                                    onChange={(e) =>
                                        { setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null)); }
                                    }
                                />
                                <Input
                                    placeholder='Description (optional)'
                                    value={editingTemplate.description ?? ''}
                                    onChange={(e) =>
                                        { setEditingTemplate((prev) =>
                                            prev ? { ...prev, description: e.target.value } : null
                                        ); }
                                    }
                                />
                                <Textarea
                                    placeholder='Template content'
                                    value={editingTemplate.content}
                                    onChange={(e) =>
                                        { setEditingTemplate((prev) =>
                                            prev ? { ...prev, content: e.target.value } : null
                                        ); }
                                    }
                                    className='min-h-[100px] font-mono text-sm'
                                />
                                <div className='flex justify-end gap-2'>
                                    <Button variant='outline' size='sm' onClick={() => { setEditingTemplate(null); }}>
                                        Cancel
                                    </Button>
                                    <Button size='sm' onClick={handleUpdate}>
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className='space-y-2'>
                        {filteredTemplates.map((template) => (
                            <div
                                key={template.id}
                                className='hover:bg-accent/50 group flex cursor-pointer items-start gap-3 rounded-lg border p-3'
                                onClick={() => { handleSelect(template); }}>
                                <div className='min-w-0 flex-1'>
                                    <div className='mb-1 flex items-center gap-2'>
                                        <span className='font-medium'>{template.name}</span>
                                        {template.isDefault && (
                                            <span className='bg-muted rounded px-1.5 py-0.5 text-xs'>Built-in</span>
                                        )}
                                    </div>
                                    {template.description && (
                                        <p className='text-muted-foreground mb-1 text-xs'>{template.description}</p>
                                    )}
                                    <pre className='text-muted-foreground bg-muted/50 truncate rounded p-2 font-mono text-xs'>
                                        {template.content}
                                    </pre>
                                </div>
                                <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-7 w-7 p-0'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTemplate(template);
                                        }}>
                                        <Edit className='h-3 w-3' />
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-7 w-7 p-0'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const duplicate: CommitTemplate = {
                                                ...template,
                                                id: Date.now().toString(),
                                                name: `${template.name} (Copy)`,
                                                isDefault: false,
                                            };
                                            onTemplatesChange([...templates, duplicate]);
                                        }}>
                                        <Copy className='h-3 w-3' />
                                    </Button>
                                    {!template.isDefault && (
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-7 w-7 p-0 text-destructive'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(template.id);
                                            }}>
                                            <Trash2 className='h-3 w-3' />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredTemplates.length === 0 && (
                            <div className='text-muted-foreground py-8 text-center'>
                                <FileText className='mx-auto mb-2 h-8 w-8 opacity-50' />
                                <p>No templates found</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className='text-muted-foreground border-t pt-2 text-xs'>
                    Tip: Type <code className='bg-muted rounded px-1'>t:</code> in the commit message field to quickly
                    access templates
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Template quick insert component for commit panel
interface TemplateQuickInsertProps {
    onSelect: (template: CommitTemplate) => void;
    templates: CommitTemplate[];
}

export function TemplateQuickInsert({ onSelect, templates }: TemplateQuickInsertProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const filtered = templates.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 6);

    return (
        <div className='relative'>
            <Button variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={() => { setIsOpen(!isOpen); }}>
                <FileText className='mr-1 h-3 w-3' />
                Template
            </Button>

            {isOpen && (
                <div className='bg-popover absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border p-1 shadow-lg'>
                    <Input
                        placeholder='Search...'
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value); }}
                        className='mb-1 h-7 text-xs'
                        autoFocus
                    />
                    {filtered.map((template) => (
                        <button
                            key={template.id}
                            className='hover:bg-accent w-full rounded px-2 py-1 text-left text-xs'
                            onClick={() => {
                                onSelect(template);
                                setIsOpen(false);
                                setFilter('');
                            }}>
                            {template.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
