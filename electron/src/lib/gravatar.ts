const hexChars = '0123456789abcdef';
const gravatarCache = new Map<string, string>();

function add32(a: number, b: number): number {
	return (a + b) & 0xffffffff;
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
	a = add32(add32(a, q), add32(x, t));
	return add32((a << s) | (a >>> (32 - s)), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md5Cycle(state: [number, number, number, number], block: number[]): void {
	let [a, b, c, d] = state;
	const at = (index: number): number => block[index] ?? 0;

	a = ff(a, b, c, d, at(0), 7, -680876936);
	d = ff(d, a, b, c, at(1), 12, -389564586);
	c = ff(c, d, a, b, at(2), 17, 606105819);
	b = ff(b, c, d, a, at(3), 22, -1044525330);
	a = ff(a, b, c, d, at(4), 7, -176418897);
	d = ff(d, a, b, c, at(5), 12, 1200080426);
	c = ff(c, d, a, b, at(6), 17, -1473231341);
	b = ff(b, c, d, a, at(7), 22, -45705983);
	a = ff(a, b, c, d, at(8), 7, 1770035416);
	d = ff(d, a, b, c, at(9), 12, -1958414417);
	c = ff(c, d, a, b, at(10), 17, -42063);
	b = ff(b, c, d, a, at(11), 22, -1990404162);
	a = ff(a, b, c, d, at(12), 7, 1804603682);
	d = ff(d, a, b, c, at(13), 12, -40341101);
	c = ff(c, d, a, b, at(14), 17, -1502002290);
	b = ff(b, c, d, a, at(15), 22, 1236535329);

	a = gg(a, b, c, d, at(1), 5, -165796510);
	d = gg(d, a, b, c, at(6), 9, -1069501632);
	c = gg(c, d, a, b, at(11), 14, 643717713);
	b = gg(b, c, d, a, at(0), 20, -373897302);
	a = gg(a, b, c, d, at(5), 5, -701558691);
	d = gg(d, a, b, c, at(10), 9, 38016083);
	c = gg(c, d, a, b, at(15), 14, -660478335);
	b = gg(b, c, d, a, at(4), 20, -405537848);
	a = gg(a, b, c, d, at(9), 5, 568446438);
	d = gg(d, a, b, c, at(14), 9, -1019803690);
	c = gg(c, d, a, b, at(3), 14, -187363961);
	b = gg(b, c, d, a, at(8), 20, 1163531501);
	a = gg(a, b, c, d, at(13), 5, -1444681467);
	d = gg(d, a, b, c, at(2), 9, -51403784);
	c = gg(c, d, a, b, at(7), 14, 1735328473);
	b = gg(b, c, d, a, at(12), 20, -1926607734);

	a = hh(a, b, c, d, at(5), 4, -378558);
	d = hh(d, a, b, c, at(8), 11, -2022574463);
	c = hh(c, d, a, b, at(11), 16, 1839030562);
	b = hh(b, c, d, a, at(14), 23, -35309556);
	a = hh(a, b, c, d, at(1), 4, -1530992060);
	d = hh(d, a, b, c, at(4), 11, 1272893353);
	c = hh(c, d, a, b, at(7), 16, -155497632);
	b = hh(b, c, d, a, at(10), 23, -1094730640);
	a = hh(a, b, c, d, at(13), 4, 681279174);
	d = hh(d, a, b, c, at(0), 11, -358537222);
	c = hh(c, d, a, b, at(3), 16, -722521979);
	b = hh(b, c, d, a, at(6), 23, 76029189);
	a = hh(a, b, c, d, at(9), 4, -640364487);
	d = hh(d, a, b, c, at(12), 11, -421815835);
	c = hh(c, d, a, b, at(15), 16, 530742520);
	b = hh(b, c, d, a, at(2), 23, -995338651);

	a = ii(a, b, c, d, at(0), 6, -198630844);
	d = ii(d, a, b, c, at(7), 10, 1126891415);
	c = ii(c, d, a, b, at(14), 15, -1416354905);
	b = ii(b, c, d, a, at(5), 21, -57434055);
	a = ii(a, b, c, d, at(12), 6, 1700485571);
	d = ii(d, a, b, c, at(3), 10, -1894986606);
	c = ii(c, d, a, b, at(10), 15, -1051523);
	b = ii(b, c, d, a, at(1), 21, -2054922799);
	a = ii(a, b, c, d, at(8), 6, 1873313359);
	d = ii(d, a, b, c, at(15), 10, -30611744);
	c = ii(c, d, a, b, at(6), 15, -1560198380);
	b = ii(b, c, d, a, at(13), 21, 1309151649);
	a = ii(a, b, c, d, at(4), 6, -145523070);
	d = ii(d, a, b, c, at(11), 10, -1120210379);
	c = ii(c, d, a, b, at(2), 15, 718787259);
	b = ii(b, c, d, a, at(9), 21, -343485551);

	state[0] = add32(state[0], a);
	state[1] = add32(state[1], b);
	state[2] = add32(state[2], c);
	state[3] = add32(state[3], d);
}

function md5Block(input: string): number[] {
	const out = new Array<number>(16).fill(0);
	for (let i = 0; i < 64; i += 4) {
		out[i >> 2] =
			input.charCodeAt(i) +
			(input.charCodeAt(i + 1) << 8) +
			(input.charCodeAt(i + 2) << 16) +
			(input.charCodeAt(i + 3) << 24);
	}
	return out;
}

function md51(input: string): [number, number, number, number] {
	const state: [number, number, number, number] = [1732584193, -271733879, -1732584194, 271733878];
	let i: number;
	for (i = 64; i <= input.length; i += 64) {
		md5Cycle(state, md5Block(input.substring(i - 64, i)));
	}

	let tail = new Array<number>(16).fill(0);
	const remainder = input.substring(i - 64);
	for (i = 0; i < remainder.length; i += 1) {
		const tailIndex = i >> 2;
		tail[tailIndex] = (tail[tailIndex] ?? 0) | (remainder.charCodeAt(i) << ((i % 4) << 3));
	}
	{
		const tailIndex = i >> 2;
		tail[tailIndex] = (tail[tailIndex] ?? 0) | (0x80 << ((i % 4) << 3));
	}
	if (i > 55) {
		md5Cycle(state, tail);
		tail = new Array<number>(16).fill(0);
	}
	tail[14] = input.length * 8;
	md5Cycle(state, tail);
	return state;
}

function rhex(value: number): string {
	let out = '';
	for (let j = 0; j < 4; j += 1) {
		const byte = (value >> (j * 8)) & 0xff;
		out += hexChars.charAt((byte >> 4) & 0x0f) + hexChars.charAt(byte & 0x0f);
	}
	return out;
}

function md5(input: string): string {
	return md51(input).map((entry) => rhex(entry)).join('');
}

export function getGravatarUrl(email: string, size: number): string {
	const normalizedEmail = email.trim().toLowerCase();
	const cacheKey = `${normalizedEmail}:${String(size)}`;
	const cached = gravatarCache.get(cacheKey);
	if (cached) return cached;

	const utf8Bytes = new TextEncoder().encode(normalizedEmail);
	let utf8Input = '';
	for (const byte of utf8Bytes) {
		utf8Input += String.fromCharCode(byte);
	}
	const hash = md5(utf8Input);
	const url = `https://www.gravatar.com/avatar/${hash}?s=${String(size)}&d=identicon`;
	gravatarCache.set(cacheKey, url);
	return url;
}
