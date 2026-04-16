/**
 * Lane-Based Commit Graph
 * Professional curved graph rendering like GitKraken/Sublime Merge
 * Separate component - can be toggled with the original graph
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';

import type { GraphLayout } from '@/lib/graph/layout';

interface Commit {
	hash: string;
	parents: string[];
	date: number;
	author: string;
	message: string;
	heads?: string[];
	tags?: string[];
	remotes?: string[];
}

interface LaneBasedGraphProps {
	commits: Commit[];
	layout: GraphLayout | null;
	selectedIndex: number | null;
	scrollTop: number;
	visibleStartIndex: number;
	visibleEndIndex: number;
	onSelectCommit: (index: number) => void;
	rowHeight?: number;
	laneWidth?: number;
	nodeRadius?: number;
	curveRadius?: number;
}

interface Edge {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	fromLane: number;
	toLane: number;
	color: string;
	type: 'straight' | 'curve' | 'branch' | 'merge';
}

// Color palette for lanes (GitKraken-inspired)
const LANE_COLORS = [
	'#4A90D9', // Blue
	'#50C878', // Green
	'#FF6B6B', // Red
	'#FFD93D', // Yellow
	'#6C5CE7', // Purple
	'#00CEC9', // Teal
	'#FD79A8', // Pink
	'#FDCB6E', // Orange
	'#636E72', // Gray
	'#2D3436', // Dark
	'#74B9FF', // Light Blue
	'#55EFC4', // Light Green
	'#81ECEC', // Cyan
	'#A29BFE', // Lavender
	'#FFEAA7', // Light Yellow
	'#DFE6E9', // Light Gray
];

function getLaneColor(laneIndex: number): string {
	return LANE_COLORS[laneIndex % LANE_COLORS.length]!;
}

export function LaneBasedGraph({
	commits,
	layout,
	selectedIndex,
	scrollTop,
	visibleStartIndex,
	visibleEndIndex,
	onSelectCommit,
	rowHeight = 32,
	laneWidth = 24,
	nodeRadius = 5,
	curveRadius: _curveRadius = 12,
}: LaneBasedGraphProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Calculate lanes for each commit
	const { commitLanes, edges, maxLanes } = useMemo(() => {
		if (!commits.length || !layout) {
			return { commitLanes: [], edges: [], maxLanes: 0 };
		}

		// Lane assignment algorithm
		const laneAssignments: Map<string, number> = new Map();
		const lanePool: number[] = [];
		const result: { lane: number; color: string }[] = [];
		const edgeList: Edge[] = [];
		let maxLane = 0;

		// Initialize with first commit on lane 0
		const firstCommit = commits[0];
		if (!firstCommit) {
			return { commitLanes: [], edges: [], maxLanes: 0 };
		}
		laneAssignments.set(firstCommit.hash, 0);
		lanePool.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

		commits.forEach((commit, index) => {
			// Get or assign lane for this commit
			let currentLane = laneAssignments.get(commit.hash);
			
			if (currentLane === undefined) {
				// New branch - take from pool or create new
				if (lanePool.length > 0) {
					currentLane = lanePool.shift()!;
				} else {
					currentLane = maxLane + 1;
					maxLane++;
				}
				laneAssignments.set(commit.hash, currentLane);
			}

			maxLane = Math.max(maxLane, currentLane);

			result.push({
				lane: currentLane,
				color: getLaneColor(currentLane),
			});

			// Process parents
			commit.parents.forEach((parentHash, parentIndex) => {
				let parentLane = laneAssignments.get(parentHash);
				
				if (parentLane === undefined) {
					// Parent not yet assigned
					if (parentIndex === 0) {
						// First parent stays on same lane
						parentLane = currentLane;
					} else {
						// Other parents get new lanes (merge)
						if (lanePool.length > 0) {
							parentLane = lanePool.shift()!;
						} else {
							parentLane = maxLane + 1;
							maxLane++;
						}
					}
					laneAssignments.set(parentHash, parentLane);
				}

				// Create edge
				const fromX = currentLane * laneWidth + laneWidth / 2;
				const toX = parentLane * laneWidth + laneWidth / 2;
				const fromY = index * rowHeight + rowHeight / 2;
				const toY = (index + 1) * rowHeight + rowHeight / 2;

				edgeList.push({
					fromX,
					fromY,
					toX,
					toY,
					fromLane: currentLane,
					toLane: parentLane,
					color: getLaneColor(currentLane),
					type: currentLane === parentLane ? 'straight' : 
						  currentLane < parentLane ? 'branch' : 'merge',
				});
			});

			// Release lane if this is a tip
			if (commit.parents.length === 0 || index === commits.length - 1) {
				lanePool.unshift(currentLane);
			}
		});

		return { commitLanes: result, edges: edgeList, maxLanes: maxLane + 1 };
	}, [commits, layout, rowHeight, laneWidth]);

	// Draw on canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Clear
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Calculate visible range
		const startIdx = Math.max(0, visibleStartIndex - 5);
		const endIdx = Math.min(commits.length - 1, visibleEndIndex + 5);

		// Draw edges
		edges.forEach((edge) => {
			const fromVisibleIdx = Math.floor(edge.fromY / rowHeight);
			const toVisibleIdx = Math.floor(edge.toY / rowHeight);

			if (fromVisibleIdx < startIdx && toVisibleIdx < startIdx) return;
			if (fromVisibleIdx > endIdx && toVisibleIdx > endIdx) return;

			ctx.beginPath();
			ctx.strokeStyle = edge.color;
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			const adjustedFromY = edge.fromY - scrollTop;
			const adjustedToY = edge.toY - scrollTop;

			if (edge.type === 'straight') {
				ctx.moveTo(edge.fromX, adjustedFromY);
				ctx.lineTo(edge.toX, adjustedToY);
			} else {
				// Bezier curve for branches and merges
				const midY = (adjustedFromY + adjustedToY) / 2;
				
				if (edge.type === 'branch') {
					// Branch curves down and right
					ctx.moveTo(edge.fromX, adjustedFromY);
					ctx.bezierCurveTo(
						edge.fromX, midY,
						edge.toX, midY,
						edge.toX, adjustedToY
					);
				} else {
					// Merge curves down and left
					ctx.moveTo(edge.fromX, adjustedFromY);
					ctx.bezierCurveTo(
						edge.fromX, midY,
						edge.toX, midY,
						edge.toX, adjustedToY
					);
				}
			}

			ctx.stroke();
		});

		// Draw nodes
		commitLanes.forEach((laneInfo, index) => {
			if (index < startIdx || index > endIdx) return;

			const x = laneInfo.lane * laneWidth + laneWidth / 2;
			const y = index * rowHeight + rowHeight / 2 - scrollTop;

			const commit = commits[index];
			if (!commit) {
				return;
			}
			const isSelected = index === selectedIndex;
			const hasRefs = commit.heads?.length || commit.tags?.length || commit.remotes?.length;

			// Outer ring for selected
			if (isSelected) {
				ctx.beginPath();
				ctx.arc(x, y, nodeRadius + 3, 0, Math.PI * 2);
				ctx.fillStyle = laneInfo.color;
				ctx.globalAlpha = 0.3;
				ctx.fill();
				ctx.globalAlpha = 1;
			}

			// Node circle
			ctx.beginPath();
			ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
			
			if (hasRefs) {
				// Filled for commits with refs
				ctx.fillStyle = laneInfo.color;
				ctx.fill();
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 2;
				ctx.stroke();
			} else {
				// Hollow for normal commits
				ctx.fillStyle = '#ffffff';
				ctx.fill();
				ctx.strokeStyle = laneInfo.color;
				ctx.lineWidth = 2;
				ctx.stroke();
			}

			// Uncommitted indicator
			if (commit.hash === '*') {
				ctx.beginPath();
				ctx.arc(x, y, nodeRadius + 2, 0, Math.PI * 2);
				ctx.strokeStyle = '#888888';
				ctx.setLineDash([2, 2]);
				ctx.stroke();
				ctx.setLineDash([]);
			}
		});
	}, [commits, commitLanes, edges, selectedIndex, scrollTop, visibleStartIndex, visibleEndIndex, rowHeight, laneWidth, nodeRadius]);

	// Handle click
	const handleClick = useCallback((e: React.MouseEvent) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top + scrollTop;
		const clickedIndex = Math.floor(y / rowHeight);

		// Check if click is on a node
		const laneInfo = commitLanes[clickedIndex];
		if (laneInfo) {
			const nodeX = laneInfo.lane * laneWidth + laneWidth / 2;
			const nodeY = clickedIndex * rowHeight + rowHeight / 2;
			const distance = Math.sqrt((x - nodeX) ** 2 + ((y - scrollTop) - (nodeY - scrollTop)) ** 2);

			if (distance <= nodeRadius + 5) {
				onSelectCommit(clickedIndex);
			}
		}
	}, [commitLanes, laneWidth, rowHeight, nodeRadius, scrollTop, onSelectCommit]);

	// Canvas dimensions
	const graphWidth = maxLanes * laneWidth + 20;
	const graphHeight = commits.length * rowHeight;

	return (
		<div 
			ref={containerRef}
			className="lane-graph relative"
			style={{ width: graphWidth, height: '100%' }}
		>
			<canvas
				ref={canvasRef}
				width={graphWidth}
				height={graphHeight}
				onClick={handleClick}
				className="absolute top-0 left-0 cursor-pointer"
				style={{ 
					transform: `translateY(-${scrollTop}px)`,
					willChange: 'transform',
				}}
			/>
		</div>
	);
}

// SVG-based alternative (for better quality at different zoom levels)
export function LaneBasedGraphSVG({
	commits,
	layout,
	selectedIndex,
	scrollTop,
	onSelectCommit,
	rowHeight = 32,
	laneWidth = 24,
	nodeRadius = 5,
}: LaneBasedGraphProps) {
	// Calculate lanes for each commit
	const { commitLanes, edges, maxLanes } = useMemo(() => {
		if (!commits.length || !layout) {
			return { commitLanes: [], edges: [], maxLanes: 0 };
		}

		const laneAssignments: Map<string, number> = new Map();
		const lanePool: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const result: { lane: number; color: string }[] = [];
		const edgeList: Edge[] = [];
		let maxLane = 0;

		const firstCommit = commits[0];
		if (!firstCommit) {
			return { commitLanes: [], edges: [], maxLanes: 0 };
		}
		laneAssignments.set(firstCommit.hash, 0);

		commits.forEach((commit, index) => {
			let currentLane = laneAssignments.get(commit.hash);
			
			if (currentLane === undefined) {
				currentLane = lanePool.length > 0 ? lanePool.shift()! : maxLane + 1;
				laneAssignments.set(commit.hash, currentLane);
			}

			maxLane = Math.max(maxLane, currentLane);
			result.push({ lane: currentLane, color: getLaneColor(currentLane) });

			commit.parents.forEach((parentHash) => {
				let parentLane = laneAssignments.get(parentHash);
				
				if (parentLane === undefined) {
					parentLane = lanePool.length > 0 ? lanePool.shift()! : maxLane + 1;
					laneAssignments.set(parentHash, parentLane);
					maxLane = Math.max(maxLane, parentLane);
				}

				const fromX = currentLane * laneWidth + laneWidth / 2;
				const toX = parentLane * laneWidth + laneWidth / 2;

				edgeList.push({
					fromX,
					fromY: index * rowHeight + rowHeight / 2,
					toX,
					toY: (index + 1) * rowHeight + rowHeight / 2,
					fromLane: currentLane,
					toLane: parentLane,
					color: getLaneColor(currentLane),
					type: currentLane === parentLane ? 'straight' : 
						  currentLane < parentLane ? 'branch' : 'merge',
				});
			});
		});

		return { commitLanes: result, edges: edgeList, maxLanes: maxLane + 1 };
	}, [commits, layout, rowHeight, laneWidth]);

	const graphWidth = maxLanes * laneWidth + 20;
	return (
		<svg
			className="lane-graph-svg"
			width={graphWidth}
			height={commits.length * rowHeight}
			style={{ transform: `translateY(-${scrollTop}px)` }}
		>
			{/* Edges */}
			{edges.map((edge, i) => (
				<path
					key={`edge-${i}`}
					d={
						edge.type === 'straight'
							? `M ${edge.fromX} ${edge.fromY} L ${edge.toX} ${edge.toY}`
							: `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`
					}
					stroke={edge.color}
					strokeWidth={2}
					fill="none"
					strokeLinecap="round"
				/>
			))}

			{/* Nodes */}
			{commitLanes.map((laneInfo, index) => {
				const commit = commits[index];
				if (!commit) return null;

				const x = laneInfo.lane * laneWidth + laneWidth / 2;
				const y = index * rowHeight + rowHeight / 2;
				const isSelected = index === selectedIndex;
				const hasRefs = commit.heads?.length || commit.tags?.length || commit.remotes?.length;

				return (
					<g 
						key={`node-${index}`}
						onClick={() => { onSelectCommit(index); }}
						className="cursor-pointer"
					>
						{isSelected && (
							<circle
								cx={x}
								cy={y}
								r={nodeRadius + 3}
								fill={laneInfo.color}
								opacity={0.3}
							/>
						)}
						<circle
							cx={x}
							cy={y}
							r={nodeRadius}
							fill={hasRefs ? laneInfo.color : 'white'}
							stroke={laneInfo.color}
							strokeWidth={2}
						/>
					</g>
				);
			})}
		</svg>
	);
}

export default LaneBasedGraph;
