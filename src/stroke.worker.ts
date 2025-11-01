// Worker that renders trapezoid stroke segments into an OffscreenCanvas.
// The main thread transfers an overlay canvas to this worker via transferControlToOffscreen
// and posts point batches. The worker draws directly into the offscreen canvas so the
// main thread remains responsive.

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let dpr = 1;
let DEBUG = true;
function log(msg: string) { try { (self as any).postMessage({ type: 'log', msg: `[RasterWorker] ${msg}` }); } catch {} }
let prevPoint: { x: number; y: number; p: number } | null = null;
let brushSize = 16;
let brushAlpha = 1;
let brushColor = '#eeeeee';

function init(off: OffscreenCanvas, w: number, h: number, _dpr: number) {
	canvas = off;
	dpr = _dpr || 1;
	canvas.width = Math.max(1, Math.round(w * dpr));
	canvas.height = Math.max(1, Math.round(h * dpr));
	ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
	if (!ctx) return;
	// Use a clean transform so logical coordinates from the main thread map correctly.
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = '#eeeeee';
	ctx.imageSmoothingEnabled = true;
  if (DEBUG) log(`initialized w=${w} h=${h} dpr=${dpr}`);
}

function resize(w: number, h: number, _dpr: number) {
	if (!canvas || !ctx) return;
	dpr = _dpr || dpr;
	canvas.width = Math.max(1, Math.round(w * dpr));
	canvas.height = Math.max(1, Math.round(h * dpr));
	ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (DEBUG) log(`resized w=${w} h=${h} dpr=${dpr}`);
}

// Simple line-based fallback: draw a round-capped segment between points.
function drawSegmentLine(a: { x: number; y: number; p: number }, b: { x: number; y: number; p: number }, size = 16) {
	if (!ctx) return;
	const ax = a.x, ay = a.y, ap = a.p ?? 0.5;
	const bx = b.x, by = b.y, bp = b.p ?? 0.5;
	const width = size * ((ap + bp) * 0.5);
	if (width <= 0) return;
	ctx.save();
	ctx.globalAlpha = brushAlpha;
	ctx.strokeStyle = brushColor;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(ax, ay);
	ctx.lineTo(bx, by);
	ctx.stroke();
	ctx.restore();
}

self.onmessage = (ev: MessageEvent) => {
	const data = ev.data;
	if (!data || typeof data !== 'object') return;

	if (data.type === 'init' && data.canvas) {
		try {
			init(data.canvas as OffscreenCanvas, data.width || 0, data.height || 0, data.dpr || 1);
			if (DEBUG) log('init message processed');
		} catch (e) {
			if (DEBUG) log('init failed');
		}
		return;
	}

	if (data.type === 'resize') {
		resize(data.width || 0, data.height || 0, data.dpr || dpr);
    if (DEBUG) log('resize message processed');
		return;
	}

	if (data.type === 'reset') {
		prevPoint = null;
    if (DEBUG) log('reset stroke');
		return;
	}

	if (data.type === 'params') {
		if (typeof data.size === 'number') brushSize = data.size;
		if (typeof data.alpha === 'number') brushAlpha = data.alpha;
		if (typeof data.color === 'string') {
			brushColor = data.color;
			if (ctx) ctx.fillStyle = brushColor;
		}
    if (DEBUG) log(`params size=${brushSize} alpha=${brushAlpha} color=${brushColor}`);
		return;
	}

	if (data.type === 'points' && Array.isArray(data.points)) {
		// Points are in logical (CSS) coordinates; because we set ctx.setTransform(dpr,0,0,dpr,0,0)
		// we can draw using those logical coordinates directly.
		const pts: Array<{ x: number; y: number; p: number; t?: number }> = data.points;
    if (DEBUG) log(`points x${pts.length}`);
		for (const pt of pts) {
			if (!prevPoint) {
				prevPoint = { x: pt.x, y: pt.y, p: pt.p };
				continue;
			}
			const next = { x: pt.x, y: pt.y, p: pt.p };
			drawSegmentLine(prevPoint, next, brushSize);
			prevPoint = next;
		}
		return;
	}

	if (data.type === 'snapshot') {
		try {
			const anyCanvas: any = canvas as any;
			if (anyCanvas && typeof anyCanvas.transferToImageBitmap === 'function') {
				const bmp = anyCanvas.transferToImageBitmap();
				(self as any).postMessage({ type: 'bitmap', image: bmp }, [bmp]);
				if (DEBUG) log('snapshot sent');
			} else {
				if (DEBUG) log('snapshot not supported');
			}
		} catch (e) {
			if (DEBUG) log('snapshot failed');
		}
		return;
	}
};

export {};