/**
 * Git Graph Layout Algorithm
 * Ported from git-graph/web/graph.ts
 *
 * Calculates the layout of branches and commits in the Git graph.
 */

// ==================== Types ====================

// Minimal commit interface needed for layout calculation
interface LayoutCommit {
	hash: string;
	parents: string[];
	stash?: unknown | null;
}

export interface Point {
	x: number;
	y: number;
}

export interface GraphConfig {
	colours: string[];
	grid: {
		x: number;
		y: number;
		offsetX: number;
		offsetY: number;
		expandY: number;
	};
	style: 'rounded' | 'angular';
	uncommittedChanges: 'openCircleAtUncommittedChanges' | 'openCircleAtCheckedOutCommit';
}

export interface PlacedLine {
	p1: Point;
	p2: Point;
	colour: number;
	isCommitted: boolean;
	lockedFirst: boolean;
}

export interface VertexInfo {
	id: number;
	x: number;
	colour: number;
	isCommitted: boolean;
	isCurrent: boolean;
	isStash: boolean;
	isMerge: boolean;
}

export interface GraphLayout {
	vertices: VertexInfo[];
	lines: PlacedLine[];
	width: number;
	height: number;
	vertexColours: number[];
	widthsAtVertices: number[];
	mutedCommits: boolean[];
}

const NULL_VERTEX_ID = -1;

// ==================== Vertex Class --------------------

class Vertex {
	id: number;
	isStash: boolean;
	x: number = 0;
	children: Vertex[] = [];
	parents: Vertex[] = [];
	nextParent: number = 0;
	branch: Branch | null = null;
	isCommitted: boolean = true;
	isCurrent: boolean = false;
	nextX: number = 0;
	connections: { connectsTo: Vertex | null; onBranch: Branch }[] = [];

	constructor(id: number, isStash: boolean) {
		this.id = id;
		this.isStash = isStash;
	}

	addChild(vertex: Vertex): void {
		this.children.push(vertex);
	}

	addParent(vertex: Vertex | null): void {
		if (vertex) {
			this.parents.push(vertex);
		}
	}

	getParents(): ReadonlyArray<Vertex> {
		return this.parents;
	}

	getChildren(): ReadonlyArray<Vertex> {
		return this.children;
	}

	hasParents(): boolean {
		return this.parents.length > 0;
	}

	getNextParent(): Vertex | null {
		return this.nextParent < this.parents.length ? (this.parents[this.nextParent] ?? null) : null;
	}

	registerParentProcessed(): void {
		this.nextParent++;
	}

	isMerge(): boolean {
		return this.parents.length > 1;
	}

	addToBranch(branch: Branch, x: number): void {
		if (this.branch === null) {
			this.branch = branch;
			this.x = x;
		}
	}

	isNotOnBranch(): boolean {
		return this.branch === null;
	}

	getPoint(): Point {
		return { x: this.x, y: this.id };
	}

	getNextPoint(): Point {
		return { x: this.nextX, y: this.id };
	}

	getPointConnectingTo(vertex: Vertex | null, onBranch: Branch): Point | null {
		for (let i = 0; i < this.connections.length; i++) {
			if (this.connections[i]?.connectsTo === vertex && this.connections[i]?.onBranch === onBranch) {
				return { x: i, y: this.id };
			}
		}
		return null;
	}

	registerUnavailablePoint(x: number, connectsToVertex: Vertex | null, onBranch: Branch): void {
		if (x === this.nextX) {
			this.nextX = x + 1;
			this.connections[x] = { connectsTo: connectsToVertex, onBranch: onBranch };
		}
	}

	getColour(): number {
		return this.branch !== null ? this.branch.getColour() : 0;
	}

	setNotCommitted(): void {
		this.isCommitted = false;
	}

	setCurrent(): void {
		this.isCurrent = true;
	}
}

// ==================== Branch Class --------------------

class Branch {
	private colour: number;
	private end: number = 0;
	private lines: { p1: Point; p2: Point; lockedFirst: boolean; isCommitted: boolean }[] = [];

	constructor(colour: number) {
		this.colour = colour;
	}

	getColour(): number {
		return this.colour;
	}

	getEnd(): number {
		return this.end;
	}

	setEnd(end: number): void {
		this.end = end;
	}

	addLine(p1: Point, p2: Point, isCommitted: boolean, lockedFirst: boolean): void {
		this.lines.push({ p1, p2, lockedFirst, isCommitted });
	}

	getLines(): ReadonlyArray<{ p1: Point; p2: Point; lockedFirst: boolean; isCommitted: boolean }> {
		return this.lines;
	}
}

// ==================== Graph Layout Calculator --------------------

export class GraphLayoutCalculator {
	private vertices: Vertex[] = [];
	private branches: Branch[] = [];
	private availableColours: number[] = [];

	private commits: ReadonlyArray<LayoutCommit> = [];
	private commitHead: string | null = null;
	private commitLookup: Record<string, number> = {};
	private onlyFollowFirstParent: boolean = false;

	constructor(
		private config: GraphConfig,
		private muteConfig: { mergeCommits: boolean; commitsNotAncestorsOfHead: boolean }
	) {}

	calculate(
		commits: ReadonlyArray<LayoutCommit>,
		commitHead: string | null,
		commitLookup: Record<string, number>,
		onlyFollowFirstParent: boolean
	): GraphLayout {
		this.commits = commits;
		this.commitHead = commitHead;
		this.commitLookup = commitLookup;
		this.onlyFollowFirstParent = onlyFollowFirstParent;
		this.vertices = [];
		this.branches = [];
		this.availableColours = [];

		if (commits.length === 0) {
			return this.emptyLayout();
		}

		this.buildVertices();
		this.buildBranches();

		return this.generateLayout();
	}

	private emptyLayout(): GraphLayout {
		return {
			vertices: [],
			lines: [],
			width: 0,
			height: 0,
			vertexColours: [],
			widthsAtVertices: [],
			mutedCommits: [],
		};
	}

	private buildVertices(): void {
		const nullVertex = new Vertex(NULL_VERTEX_ID, false);

		// Create vertices
		for (let i = 0; i < this.commits.length; i++) {
			const commit = this.commits[i];
			this.vertices.push(new Vertex(i, commit?.stash !== null));
		}

		// Link parents and children
		for (let i = 0; i < this.commits.length; i++) {
			const commit = this.commits[i];
			if (!commit) continue;

			for (let j = 0; j < commit.parents.length; j++) {
				const parentHash = commit.parents[j];
				if (!parentHash) continue;

				const parentIndex = this.commitLookup[parentHash];
				if (typeof parentIndex === 'number' && parentIndex >= 0) {
					const parentVertex = this.vertices[parentIndex];
					const currentVertex = this.vertices[i];
					if (parentVertex && currentVertex) {
						currentVertex.addParent(parentVertex);
						parentVertex.addChild(currentVertex);
					}
				} else if (!this.onlyFollowFirstParent || j === 0) {
					this.vertices[i]?.addParent(nullVertex);
				}
			}
		}

		// Mark uncommitted changes
		const firstCommit = this.commits[0];
		const firstVertex = this.vertices[0];
		if (firstCommit?.hash === '*' && firstVertex) {
			firstVertex.setNotCommitted();
		}

		// Mark current HEAD
		if (
			firstCommit?.hash === '*' &&
			this.config.uncommittedChanges === 'openCircleAtUncommittedChanges'
		) {
			firstVertex?.setCurrent();
		} else if (this.commitHead !== null) {
			const headIndex = this.commitLookup[this.commitHead];
			if (typeof headIndex === 'number') {
				const headVertex = this.vertices[headIndex];
				headVertex?.setCurrent();
			}
		}
	}

	private buildBranches(): void {
		let i = 0;
		while (i < this.vertices.length) {
			const vertex = this.vertices[i];
			if (
				(vertex && vertex.getNextParent() !== null) ||
				(vertex && vertex.isNotOnBranch())
			) {
				this.determinePath(i);
			} else {
				i++;
			}
		}
	}

	private determinePath(startAt: number): void {
		let i = startAt;
		let vertex = this.vertices[i];
		if (!vertex) return;

		let parentVertex = vertex.getNextParent();

		if (parentVertex === null) {
			vertex.registerParentProcessed();
			return;
		}

		let lastPoint = vertex.isNotOnBranch() ? vertex.getNextPoint() : vertex.getPoint();
		let curPoint: Point;
		let curVertex: Vertex;

		// Check for merge between two vertices already on branches
		if (
			parentVertex !== null &&
			parentVertex.id !== NULL_VERTEX_ID &&
			vertex.isMerge() &&
			!vertex.isNotOnBranch() &&
			!parentVertex.isNotOnBranch()
		) {
			// Branch is a merge between two vertices already on branches
			let foundPointToParent = false;
			const parentBranch = parentVertex.branch!;
			for (i = startAt + 1; i < this.vertices.length; i++) {
				curVertex = this.vertices[i];
				if (!curVertex) continue;

				curPoint = curVertex.getPointConnectingTo(parentVertex, parentBranch);
				if (curPoint !== null) {
					foundPointToParent = true;
				} else {
					curPoint = curVertex.getNextPoint();
				}
				parentBranch.addLine(lastPoint, curPoint, vertex.isCommitted, !foundPointToParent && curVertex !== parentVertex ? lastPoint.x < curPoint.x : true);
				curVertex.registerUnavailablePoint(curPoint.x, parentVertex, parentBranch);
				lastPoint = curPoint;

				if (foundPointToParent) {
					vertex.registerParentProcessed();
					break;
				}
			}
		} else {
			// Branch is normal
			const branch = new Branch(this.getAvailableColour(startAt));
			vertex.addToBranch(branch, lastPoint.x);
			vertex.registerUnavailablePoint(lastPoint.x, vertex, branch);

			for (i = startAt + 1; i < this.vertices.length; i++) {
				curVertex = this.vertices[i];
				if (!curVertex) continue;

				curPoint = parentVertex === curVertex && !curVertex.isNotOnBranch()
					? curVertex.getPoint()
					: curVertex.getNextPoint();

				branch.addLine(lastPoint, curPoint, vertex.isCommitted, lastPoint.x < curPoint.x);
				curVertex.registerUnavailablePoint(curPoint.x, parentVertex, branch);
				lastPoint = curPoint;

				if (parentVertex === curVertex) {
					// The parent of <vertex> has been reached, progress to continue building the branch
					vertex.registerParentProcessed();
					const parentVertexOnBranch = !curVertex.isNotOnBranch();
					curVertex.addToBranch(branch, curPoint.x);
					vertex = parentVertex;
					parentVertex = vertex.getNextParent();
					if (parentVertex === null || parentVertexOnBranch) {
						break;
					}
				}
			}

			if (i === this.vertices.length && parentVertex !== null && parentVertex.id === NULL_VERTEX_ID) {
				// Vertex is the last in the graph, so no more branch can be formed to the parent
				vertex.registerParentProcessed();
			}

			branch.setEnd(i);
			this.branches.push(branch);
			this.availableColours[branch.getColour()] = i;
		}
	}

	private getAvailableColour(startAt: number): number {
		for (let i = 0; i < this.availableColours.length; i++) {
			const colourValue = this.availableColours[i];
			if (colourValue !== undefined && startAt > colourValue) {
				return i;
			}
		}
		this.availableColours.push(0);
		return this.availableColours.length - 1;
	}

	private generateLayout(): GraphLayout {
		const vertices: VertexInfo[] = this.vertices.map((v) => ({
			id: v.id,
			x: v.x,
			colour: v.getColour(),
			isCommitted: v.isCommitted,
			isCurrent: v.isCurrent,
			isStash: v.isStash,
			isMerge: v.isMerge(),
		}));

		const lines: PlacedLine[] = [];
		for (const branch of this.branches) {
			for (const line of branch.getLines()) {
				lines.push({
					p1: line.p1,
					p2: line.p2,
					colour: branch.getColour(),
					isCommitted: line.isCommitted,
					lockedFirst: line.lockedFirst,
				});
			}
		}

		const maxX = Math.max(...this.vertices.map((v) => v.getNextPoint().x), 0);
		const width = 2 * this.config.grid.offsetX + maxX * this.config.grid.x;
		const height = this.vertices.length * this.config.grid.y + this.config.grid.offsetY;

		return {
			vertices,
			lines,
			width,
			height,
			vertexColours: vertices.map((v) => v.colour % this.config.colours.length),
			widthsAtVertices: this.vertices.map(
				(v) => this.config.grid.offsetX + v.getNextPoint().x * this.config.grid.x - 2
			),
			mutedCommits: this.getMutedCommits(),
		};
	}

	private getMutedCommits(): boolean[] {
		const muted: boolean[] = new Array(this.commits.length).fill(false);

		// Mute merge commits
		if (this.muteConfig.mergeCommits) {
			for (let i = 0; i < this.commits.length; i++) {
				const vertex = this.vertices[i];
				const commit = this.commits[i];
				if (vertex && commit && vertex.isMerge() && commit.stash === null) {
					muted[i] = true;
				}
			}
		}

		// Mute commits not ancestors of HEAD
		if (
			this.muteConfig.commitsNotAncestorsOfHead &&
			this.commitHead !== null
		) {
			const headIndex = this.commitLookup[this.commitHead];
			if (typeof headIndex === 'number') {
				const ancestor: boolean[] = new Array(this.commits.length).fill(false);
				this.markAncestors(headIndex, ancestor);

				for (let i = 0; i < this.commits.length; i++) {
					if (!ancestor[i]) {
						muted[i] = true;
					}
				}
			}
		}

		return muted;
	}

	private markAncestors(vertexId: number, ancestor: boolean[]): void {
		if (vertexId < 0 || ancestor[vertexId]) return;
		ancestor[vertexId] = true;

		const vertex = this.vertices[vertexId];
		if (!vertex) return;

		for (const parent of vertex.getParents()) {
			this.markAncestors(parent.id, ancestor);
		}
	}
}

// ==================== Default Config --------------------

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
	colours: [
		'#0085d9',
		'#d9008f',
		'#00d90a',
		'#d98500',
		'#a300d9',
		'#ff0000',
		'#00d9cc',
		'#e138e8',
		'#85d900',
		'#dc5b23',
		'#6f24d6',
		'#ffcc00',
	],
	grid: {
		x: 16,
		y: 24,
		offsetX: 16,
		offsetY: 12,
		expandY: 250,
	},
	style: 'rounded',
	uncommittedChanges: 'openCircleAtUncommittedChanges',
};
