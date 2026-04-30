import type { GraphConfig } from './layout';

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
		y: 32,
		offsetX: 16,
		offsetY: 16,
		expandY: 250,
	},
	style: 'rounded',
	uncommittedChanges: 'openCircleAtUncommittedChanges',
};
