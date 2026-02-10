/**
 * Git Graph SVG Renderer
 * Renders the commit graph using SVG
 */

import { useMemo } from 'react';
import type { GraphLayout, GraphConfig } from '@/lib/graph/layout';

interface CommitGraphProps {
	layout: GraphLayout | null;
	config: GraphConfig;
	expandedIndex: number;
	onVertexClick: (index: number) => void;
	onVertexHover: (index: number | null) => void;
}

export function CommitGraph({
	layout,
	config,
	expandedIndex,
	onVertexClick,
	onVertexHover,
}: CommitGraphProps) {
	const { paths, vertices } = useMemo(() => {
		if (!layout) return { paths: [], vertices: [] };

		const paths: {
			d: string;
			colour: string;
			isCommitted: boolean;
		}[] = [];

		// Offset to center vertices in rows
		const rowHeight = config.grid.y;
		const centerY = rowHeight / 2;
		const curveOffset = rowHeight * 0.4;

		for (const line of layout.lines) {
			const x1 = line.p1.x * config.grid.x + config.grid.offsetX;
			const y1 = line.p1.y * config.grid.y + centerY;
			const x2 = line.p2.x * config.grid.x + config.grid.offsetX;
			const y2 = line.p2.y * config.grid.y + centerY;

			// Adjust for expanded commit
			const adjustedY1 = expandedIndex > -1 && line.p1.y > expandedIndex ? y1 + config.grid.expandY : y1;
			const adjustedY2 = expandedIndex > -1 && line.p2.y > expandedIndex ? y2 + config.grid.expandY : y2;

			const colour = config.colours[line.colour % config.colours.length] ?? '#808080';

			let pathD = `M${x1},${adjustedY1.toFixed(1)}`;

			if (x1 === x2) {
				pathD += `L${x2},${adjustedY2.toFixed(1)}`;
			} else if (config.style === 'angular') {
				const midY = line.lockedFirst
					? adjustedY2 - curveOffset
					: adjustedY1 + curveOffset;
				pathD += `L${x2},${midY.toFixed(1)}L${x2},${adjustedY2.toFixed(1)}`;
			} else {
				pathD += `C${x1},${(adjustedY1 + curveOffset).toFixed(1)} ${x2},${(adjustedY2 - curveOffset).toFixed(1)} ${x2},${adjustedY2.toFixed(1)}`;
			}

			paths.push({
				d: pathD,
				colour,
				isCommitted: line.isCommitted,
			});
		}

		const vertices = layout.vertices.map((v) => ({
			id: v.id,
			cx: v.x * config.grid.x + config.grid.offsetX,
			cy: v.id * config.grid.y + centerY + (expandedIndex > -1 && v.id > expandedIndex ? config.grid.expandY : 0),
			colour: config.colours[v.colour % config.colours.length] ?? '#808080',
			isCommitted: v.isCommitted,
			isCurrent: v.isCurrent,
			isStash: v.isStash,
		}));

		return { paths, vertices };
	}, [layout, config, expandedIndex]);

	if (!layout) return null;

	// Height matches commit list (vertices.length * ROW_HEIGHT)
	const height = layout.vertices.length * config.grid.y + (expandedIndex > -1 ? config.grid.expandY : 0);

	return (
		<svg
			width={layout.width}
			height={height}
			className="commit-graph"
		>
			{/* Branch lines */}
			<g className="branch-lines">
				{paths.map((path, i) => (
					<g key={i}>
						<path
							d={path.d}
							className="shadow"
							fill="none"
							stroke="var(--background)"
							strokeWidth={4}
							strokeOpacity={0.8}
						/>
						<path
							d={path.d}
							className="line"
							fill="none"
							stroke={path.isCommitted ? path.colour : '#808080'}
							strokeWidth={2}
							strokeDasharray={!path.isCommitted && config.uncommittedChanges === 'openCircleAtCheckedOutCommit' ? '2px' : undefined}
						/>
					</g>
				))}
			</g>

			{/* Commit vertices */}
			<g className="commit-vertices">
				{vertices.map((v) => (
					<g key={v.id}>
						{v.isCurrent ? (
							<circle
								cx={v.cx}
								cy={v.cy}
								r={6}
								fill="var(--background)"
								stroke={v.colour}
								strokeWidth={2.5}
								className="cursor-pointer"
								onClick={() => onVertexClick(v.id)}
								onMouseEnter={() => onVertexHover(v.id)}
								onMouseLeave={() => onVertexHover(null)}
							/>
						) : (
							<circle
								cx={v.cx}
								cy={v.cy}
								r={v.isStash ? 5 : 4.5}
								fill={v.isCommitted ? v.colour : '#808080'}
								stroke="var(--background)"
								strokeWidth={1.5}
								className="cursor-pointer"
								onClick={() => onVertexClick(v.id)}
								onMouseEnter={() => onVertexHover(v.id)}
								onMouseLeave={() => onVertexHover(null)}
							/>
						)}
						{v.isStash && !v.isCurrent && (
							<circle
								cx={v.cx}
								cy={v.cy}
								r={2}
								fill="var(--background)"
								pointerEvents="none"
							/>
						)}
					</g>
				))}
			</g>
		</svg>
	);
}
