/**
 * Lane-Based Commit Graph
 * Clean, simplified implementation that works with ScrollArea
 */

import { useMemo } from 'react';

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

interface LaneGraphProps {
	commits: Commit[];
	selectedIndex: number | null;
	onSelectCommit: (index: number) => void;
	rowHeight?: number;
}

// Lane colors - GitKraken inspired palette
const LANE_COLORS = [
	'#4A90D9', // Blue
	'#50C878', // Green
	'#FF6B6B', // Red
	'#FFD93D', // Yellow
	'#6C5CE7', // Purple
	'#00CEC9', // Teal
	'#FD79A8', // Pink
	'#FDCB6E', // Orange
	'#74B9FF', // Light Blue
	'#55EFC4', // Light Green
	'#A29BFE', // Lavender
	'#81ECEC', // Cyan
];

function getLaneColor(laneIndex: number): string {
	return LANE_COLORS[laneIndex % LANE_COLORS.length] ?? LANE_COLORS[0] ?? '#4A90D9';
}

export function LaneGraph({
	commits,
	selectedIndex,
	onSelectCommit,
	rowHeight = 32,
}: LaneGraphProps) {
	const laneWidth = 24;
	const paddingX = 12;
	const nodeRadius = 5;

	// Calculate lane assignments and edges
	const { lanes, edges, maxLane, height } = useMemo(() => {
		if (!commits.length) {
			return { lanes: [], edges: [], maxLane: 0, height: 0 };
		}

		// Map commit hash to lane index
		const commitToLane = new Map<string, number>();
		// Track active lanes (lanes that have commits that need to connect to future commits)
		const activeLanes = new Set<number>();
		// Pool of available lane indices
		const lanePool: number[] = [];
		
		const lanesData: Array<{ lane: number; color: string }> = [];
		const edgesData: Array<{
			fromX: number;
			fromY: number;
			toX: number;
			toY: number;
			color: string;
			curve: boolean;
		}> = [];

		let maxLaneIdx = 0;

		// First pass: assign lanes
		commits.forEach((commit, index) => {
			// Check if this commit is already in a lane (from a child commit)
			let lane = commitToLane.get(commit.hash);
			
			if (lane === undefined) {
				// New branch - get lane from pool or create new
				if (lanePool.length > 0) {
					lane = lanePool.shift()!;
				} else {
					lane = maxLaneIdx++;
				}
				commitToLane.set(commit.hash, lane);
			}

			activeLanes.add(lane);
			lanesData.push({ lane, color: getLaneColor(lane) });

			// Process parents
			commit.parents.forEach((parentHash, parentIdx) => {
				let parentLane = commitToLane.get(parentHash);
				
				if (parentLane === undefined) {
					if (parentIdx === 0) {
						// First parent continues on same lane
						parentLane = lane;
					} else {
						// Other parents get new lanes (merge from another branch)
						if (lanePool.length > 0) {
							parentLane = lanePool.shift()!;
						} else {
							parentLane = maxLaneIdx++;
						}
					}
					commitToLane.set(parentHash, parentLane);
				}

				// Create edge from commit to parent
				const fromX = paddingX + lane * laneWidth + laneWidth / 2;
				const fromY = index * rowHeight + rowHeight / 2;
				const toX = paddingX + parentLane * laneWidth + laneWidth / 2;
				const toY = (index + 1) * rowHeight + rowHeight / 2;

				edgesData.push({
					fromX,
					fromY,
					toX,
					toY,
					color: getLaneColor(lane),
					curve: lane !== parentLane,
				});
			});

			// If this commit has no more children referencing it, release its lane
			// (simplified: we keep lanes active for the whole graph)
		});

		const totalHeight = commits.length * rowHeight;
		const totalWidth = paddingX * 2 + (maxLaneIdx + 1) * laneWidth;

		return {
			lanes: lanesData,
			edges: edgesData,
			maxLane: maxLaneIdx,
			height: totalHeight,
			width: totalWidth,
		};
	}, [commits, rowHeight, laneWidth, paddingX]);

	if (!commits.length) return null;

	const width = paddingX * 2 + (maxLane + 1) * laneWidth;

	return (
		<svg
			width={width}
			height={height}
			className="block"
			style={{ minWidth: width }}
		>
			{/* Edges (lines connecting commits) */}
			<g className="edges">
				{edges.map((edge, i) => (
					<path
						key={`edge-${i}`}
						d={
							edge.curve
								? `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`
								: `M ${edge.fromX} ${edge.fromY} L ${edge.toX} ${edge.toY}`
						}
						stroke={edge.color}
						strokeWidth={2}
						fill="none"
						opacity={0.7}
					/>
				))}
			</g>

			{/* Nodes (commit dots) */}
			<g className="nodes">
				{lanes.map((laneData, index) => {
					const commit = commits[index];
					if (!commit) return null;
					const x = paddingX + laneData.lane * laneWidth + laneWidth / 2;
					const y = index * rowHeight + rowHeight / 2;
					const isSelected = selectedIndex === index;

					return (
						<g key={`node-${index}`}>
							{/* Outer ring for selected */}
							{isSelected && (
								<circle
									cx={x}
									cy={y}
									r={nodeRadius + 3}
									fill="none"
									stroke={laneData.color}
									strokeWidth={2}
								/>
							)}
							{/* Node circle */}
							<circle
								cx={x}
								cy={y}
								r={nodeRadius}
								fill={laneData.color}
								className="cursor-pointer hover:opacity-80 transition-opacity"
								onClick={() => onSelectCommit(index)}
							/>
							{/* Branch/tag indicators */}
							{(commit.heads?.length || commit.tags?.length) && (
								<circle
									cx={x}
									cy={y}
									r={nodeRadius + 2}
									fill="none"
									stroke="#fff"
									strokeWidth={1.5}
									opacity={0.5}
								/>
							)}
						</g>
					);
				})}
			</g>
		</svg>
	);
}

export default LaneGraph;
