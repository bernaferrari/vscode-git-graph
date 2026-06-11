/**
 * Git Graph SVG Renderer
 * Renders the commit graph using SVG with optional avatars on nodes
 */

import { useMemo } from 'react';

import { getGravatarUrl } from '@/lib/gravatar';

import type { GraphLayout, GraphConfig } from '@/lib/graph/layout';

interface CommitInfo {
    hash: string;
    author: string;
    email: string;
}

interface CommitGraphProps {
    layout: GraphLayout | null;
    config: GraphConfig;
    expandedIndex: number;
    selectedIndex?: number | null;
    onVertexClick: (index: number) => void;
    /**
     * Fires when a user shift- or alt-clicks a commit dot. The host renders an
     * inline quick-actions popover at (clientX, clientY) — see CommitDotQuickActions.
     */
    onVertexQuickActions?: (index: number, position: { x: number; y: number }) => void;
    onVertexHover: (index: number | null) => void;
    commits?: CommitInfo[];
    showAvatars?: boolean;
    visibleStartIndex?: number;
    visibleEndIndex?: number;
}

export function CommitGraph({
    layout,
    config,
    expandedIndex,
    selectedIndex = null,
    onVertexClick,
    onVertexQuickActions,
    onVertexHover,
    commits = [],
    showAvatars = false,
    visibleStartIndex,
    visibleEndIndex,
}: CommitGraphProps) {
    const VIEW_BUFFER_ROWS = 160;

    const { paths, vertices } = useMemo(() => {
        if (!layout) return { paths: [], vertices: [] };

        const paths: {
            d: string;
            colour: string;
            isCommitted: boolean;
            isEmphasized: boolean;
        }[] = [];

        // Offset to center vertices in rows
        const rowHeight = config.grid.y;
        const centerY = rowHeight / 2;
        const curveOffset = rowHeight * 0.4;

        const minVisibleIndex = Math.max(0, (visibleStartIndex ?? 0) - VIEW_BUFFER_ROWS);
        const maxVisibleIndex = (visibleEndIndex ?? layout.vertices.length) + VIEW_BUFFER_ROWS;
        const windowOffset = (visibleStartIndex ?? 0) * rowHeight;

        for (const line of layout.lines) {
            const maxIndex = Math.max(line.p1.y, line.p2.y);
            const minIndex = Math.min(line.p1.y, line.p2.y);
            if (maxIndex < minVisibleIndex || minIndex > maxVisibleIndex) {
                continue;
            }

            const x1 = line.p1.x * config.grid.x + config.grid.offsetX;
            const y1 = line.p1.y * config.grid.y + centerY - windowOffset;
            const x2 = line.p2.x * config.grid.x + config.grid.offsetX;
            const y2 = line.p2.y * config.grid.y + centerY - windowOffset;

            // Adjust for expanded commit
            const adjustedY1 = expandedIndex > -1 && line.p1.y > expandedIndex ? y1 + config.grid.expandY : y1;
            const adjustedY2 = expandedIndex > -1 && line.p2.y > expandedIndex ? y2 + config.grid.expandY : y2;

            const colour = config.colours[line.colour % config.colours.length] ?? '#808080';

            let pathD = `M${String(x1)},${String(adjustedY1)}`;

            if (x1 === x2) {
                pathD += `L${String(x2)},${String(adjustedY2)}`;
            } else if (config.style === 'angular') {
                const midY = line.lockedFirst ? adjustedY2 - curveOffset : adjustedY1 + curveOffset;
                pathD += `L${String(x2)},${String(midY)}L${String(x2)},${String(adjustedY2)}`;
            } else {
                pathD += `C${String(x1)},${String(adjustedY1 + curveOffset)} ${String(x2)},${String(adjustedY2 - curveOffset)} ${String(x2)},${String(adjustedY2)}`;
            }

            paths.push({
                d: pathD,
                colour,
                isCommitted: line.isCommitted,
                isEmphasized: selectedIndex !== null && (line.p1.y === selectedIndex || line.p2.y === selectedIndex),
            });
        }

        const vertices = layout.vertices
            .filter((v) => v.id >= minVisibleIndex && v.id <= maxVisibleIndex)
            .map((v) => ({
                id: v.id,
                cx: v.x * config.grid.x + config.grid.offsetX,
                cy:
                    v.id * config.grid.y +
                    centerY +
                    (expandedIndex > -1 && v.id > expandedIndex ? config.grid.expandY : 0) -
                    windowOffset,
                colour: config.colours[v.colour % config.colours.length] ?? '#808080',
                isCommitted: v.isCommitted,
                isCurrent: v.isCurrent,
                isStash: v.isStash,
            }));

        return { paths, vertices };
    }, [layout, config, expandedIndex, selectedIndex, visibleStartIndex, visibleEndIndex]);

    if (!layout) return null;

    // Keep the SVG viewport bounded to the visible region for performance.
    const visibleSpan =
        visibleStartIndex !== undefined && visibleEndIndex !== undefined
            ? Math.max(16, visibleEndIndex - visibleStartIndex + 1)
            : layout.vertices.length;
    const height = visibleSpan * config.grid.y + 600;

    return (
        <svg width={layout.width} height={height} className='commit-graph' shapeRendering='geometricPrecision'>
            {/* Branch lines */}
            <g className='branch-lines'>
                {paths.map((path, i) => (
                    <g key={i}>
                        <path
                            d={path.d}
                            className='shadow'
                            fill='none'
                            stroke='var(--background)'
                            strokeWidth={path.isEmphasized ? 4.5 : 3.5}
                            strokeOpacity={path.isEmphasized ? 0.9 : 0.72}
                        />
                        <path
                            d={path.d}
                            className='line'
                            fill='none'
                            stroke={path.isCommitted ? path.colour : '#808080'}
                            strokeOpacity={path.isEmphasized ? 1 : 0.82}
                            strokeWidth={path.isEmphasized ? 2.4 : 1.9}
                            strokeDasharray={
                                !path.isCommitted && config.uncommittedChanges === 'openCircleAtCheckedOutCommit'
                                    ? '2px'
                                    : undefined
                            }
                        />
                    </g>
                ))}
            </g>

            {/* Commit vertices */}
            <g className='commit-vertices'>
                {vertices.map((v) => {
                    const commit = commits[v.id];
                    const hasAvatar = showAvatars && commit?.email;
                    const normalRadius = v.isCurrent ? 6 : v.isStash ? 5 : 4.5;
                    const avatarRadius = 10; // Smaller avatar size
                    const isSelected = selectedIndex === v.id;

                    return (
                        <g key={v.id}>
                            {hasAvatar ? (
                                // Avatar on top of smaller node
                                <g
                                    className='cursor-pointer'
                                    onClick={(e) => {
                                        // Plain click on the dot opens the quick-actions card.
                                        // Cmd/Ctrl-click falls back to selection (row-style behaviour).
                                        if (onVertexQuickActions && !e.metaKey && !e.ctrlKey) {
                                            e.stopPropagation();
                                            onVertexQuickActions(v.id, { x: e.clientX, y: e.clientY });
                                            return;
                                        }
                                        onVertexClick(v.id);
                                    }}
                                    onMouseEnter={() => {
                                        onVertexHover(v.id);
                                    }}
                                    onMouseLeave={() => {
                                        onVertexHover(null);
                                    }}>
                                    {/* Small colored circle underneath */}
                                    <circle cx={v.cx} cy={v.cy} r={avatarRadius + 1} fill={v.colour} />
                                    {/* White background for avatar */}
                                    <circle cx={v.cx} cy={v.cy} r={avatarRadius - 1} fill='var(--background)' />
                                    {/* Avatar image */}
                                    <image
                                        href={getGravatarUrl(commit.email, 64)}
                                        x={v.cx - avatarRadius + 2}
                                        y={v.cy - avatarRadius + 2}
                                        width={(avatarRadius - 2) * 2}
                                        height={(avatarRadius - 2) * 2}
                                        style={{ clipPath: `circle(${String(avatarRadius - 2)}px)` }}
                                        className='pointer-events-none'
                                    />
                                    {/* Current commit ring */}
                                    {v.isCurrent && (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={avatarRadius + 3}
                                            fill='none'
                                            stroke={v.colour}
                                            strokeWidth={2}
                                            opacity={0.6}
                                        />
                                    )}
                                    {isSelected && (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={avatarRadius + 5}
                                            fill='none'
                                            stroke='hsl(var(--primary))'
                                            strokeWidth={1.5}
                                            opacity={0.9}
                                            pointerEvents='none'
                                        />
                                    )}
                                </g>
                            ) : (
                                // Normal circle node (no avatar)
                                <>
                                    {v.isCurrent ? (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={normalRadius}
                                            fill='var(--background)'
                                            stroke={v.colour}
                                            strokeWidth={2.5}
                                            className='cursor-pointer'
                                            onClick={(e) => {
                                                if (onVertexQuickActions && !e.metaKey && !e.ctrlKey) {
                                                    e.stopPropagation();
                                                    onVertexQuickActions(v.id, { x: e.clientX, y: e.clientY });
                                                    return;
                                                }
                                                onVertexClick(v.id);
                                            }}
                                            onMouseEnter={() => {
                                                onVertexHover(v.id);
                                            }}
                                            onMouseLeave={() => {
                                                onVertexHover(null);
                                            }}
                                        />
                                    ) : (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={normalRadius}
                                            fill={v.isCommitted ? v.colour : '#808080'}
                                            stroke='var(--background)'
                                            strokeWidth={1.5}
                                            className='cursor-pointer'
                                            onClick={(e) => {
                                                if (onVertexQuickActions && !e.metaKey && !e.ctrlKey) {
                                                    e.stopPropagation();
                                                    onVertexQuickActions(v.id, { x: e.clientX, y: e.clientY });
                                                    return;
                                                }
                                                onVertexClick(v.id);
                                            }}
                                            onMouseEnter={() => {
                                                onVertexHover(v.id);
                                            }}
                                            onMouseLeave={() => {
                                                onVertexHover(null);
                                            }}
                                        />
                                    )}
                                    {v.isStash && !v.isCurrent && (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={2}
                                            fill='var(--background)'
                                            pointerEvents='none'
                                        />
                                    )}
                                    {isSelected && (
                                        <circle
                                            cx={v.cx}
                                            cy={v.cy}
                                            r={normalRadius + 4}
                                            fill='none'
                                            stroke='hsl(var(--primary))'
                                            strokeWidth={1.5}
                                            opacity={0.85}
                                            pointerEvents='none'
                                        />
                                    )}
                                </>
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
