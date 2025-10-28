// Worker that renders trapezoid stroke segments into an OffscreenCanvas.
// The main thread transfers an overlay canvas to this worker via transferControlToOffscreen
// and posts point batches. The worker draws directly into the offscreen canvas so the
// main thread remains responsive.

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let dpr = 1;
let prevPoint: { x: number; y: number; p: number } | null = null;
let brushSize = 16;
let brushAlpha = 1;
let brushColor = '#eeeeee';

function init(off: OffscreenCanvas, w: number, h: number, _dpr: number) {
	canvas = off;
	dpr = _dpr || 1;
	canvas.width = w;
	canvas.height = h;
	ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
	if (!ctx) return;
	// Use a clean transform so logical coordinates from the main thread map correctly.
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = '#eeeeee';
	ctx.imageSmoothingEnabled = true;
}

function resize(w: number, h: number, _dpr: number) {
	if (!canvas || !ctx) return;
	dpr = _dpr || dpr;
	canvas.width = w;
	canvas.height = h;
	ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawTrapezoid(a: { x: number; y: number; p: number }, b: { x: number; y: number; p: number }, size = 16) {
	if (!ctx) return;
	const ax = a.x, ay = a.y, ap = a.p ?? 0.5;
	const bx = b.x, by = b.y, bp = b.p ?? 0.5;

	let dx = bx - ax;
	let dy = by - ay;
	let dist = Math.hypot(dx, dy);
	if (dist < 0.001) return;

	const px = -dy / dist;
	const py = dx / dist;

	const aWidth = (size * ap) * 0.5;
	const bWidth = (size * bp) * 0.5;

	const x1 = ax + px * aWidth;
	const y1 = ay + py * aWidth;
	const x2 = ax - px * aWidth;
	const y2 = ay - py * aWidth;
	const x3 = bx - px * bWidth;
	const y3 = by - py * bWidth;
	const x4 = bx + px * bWidth;
	const y4 = by + py * bWidth;

	// Draw two triangles using the OTHER diagonal: (AL, AR, BR) and (AL, BR, BL)
	ctx.save();
	ctx.globalAlpha = brushAlpha;
	ctx.fillStyle = brushColor;

	// Triangle 1: AL, AR, BR
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.lineTo(x3, y3);
	ctx.closePath();
	ctx.fill();

	// Triangle 2: AL, BR, BL
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x3, y3);
	ctx.lineTo(x4, y4);
	ctx.closePath();
	ctx.fill();

	ctx.restore();
}

self.onmessage = (ev: MessageEvent) => {
	const data = ev.data;
	if (!data || typeof data !== 'object') return;

	if (data.type === 'init' && data.canvas) {
		try {
			init(data.canvas as OffscreenCanvas, data.width || 0, data.height || 0, data.dpr || 1);
			(self as any).postMessage({ type: 'log', msg: 'initialized' });
		} catch (e) {
			(self as any).postMessage({ type: 'log', msg: 'init failed' });
		}
		return;
	}

	if (data.type === 'resize') {
		resize(data.width || 0, data.height || 0, data.dpr || dpr);
		return;
	}

	if (data.type === 'reset') {
		prevPoint = null;
		return;
	}

	if (data.type === 'params') {
		if (typeof data.size === 'number') brushSize = data.size;
		if (typeof data.alpha === 'number') brushAlpha = data.alpha;
		if (typeof data.color === 'string') {
			brushColor = data.color;
			if (ctx) ctx.fillStyle = brushColor;
		}
		return;
	}

	if (data.type === 'points' && Array.isArray(data.points)) {
		// Points are in logical (CSS) coordinates; because we set ctx.setTransform(dpr,0,0,dpr,0,0)
		// we can draw using those logical coordinates directly.
		const pts: Array<{ x: number; y: number; p: number; t?: number }> = data.points;
		for (const pt of pts) {
			if (!prevPoint) {
				prevPoint = { x: pt.x, y: pt.y, p: pt.p };
				continue;
			}
			const next = { x: pt.x, y: pt.y, p: pt.p };
			drawTrapezoid(prevPoint, next, brushSize);
			prevPoint = next;
		}
		return;
	}
};

export {};