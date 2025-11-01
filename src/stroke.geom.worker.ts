// Worker that converts pointer points into trapezoid mesh geometry
// Produces clip-space positions and RGBA colors per vertex, plus indices
// Messages:
// - { type: 'init', width: number, height: number }
// - { type: 'params', size: number, alpha: number, colorRGB: [number, number, number], sizeFromSpeed?: boolean, speedInfluence?: number }
// - { type: 'reset' }
// - { type: 'points', points: Array<{ x: number; y: number; p?: number; t?: number }> }

export type GeomMsgIn =
  | { type: 'init'; width: number; height: number }
  | { type: 'params'; size: number; alpha: number; colorRGB: [number, number, number]; sizeFromSpeed?: boolean; speedInfluence?: number }
  | { type: 'reset' }
  | { type: 'points'; points: Array<{ x: number; y: number; p?: number; t?: number }> };

export type GeomMsgOut =
  | { type: 'geometry'; positions: Float32Array; colors: Float32Array; indices: Uint16Array }
  | { type: 'log'; msg: string };

let screenW = 1;
let screenH = 1;
let brushSize = 16;
let baseAlpha = 0.1;
let colorRGB: [number, number, number] = [1, 1, 1];
let sizeFromSpeed = false;
let speedInfluence = 0.5; // 0..1

// Keep minimal history for smoothing and previous edge continuity
let pointHistory: Array<{ x: number; y: number; p: number; t: number }> = [];
let prevLeft: [number, number] | null = null;
let prevRight: [number, number] | null = null;

function toClip(x: number, y: number): [number, number] {
  return [ (x / screenW) * 2 - 1, (y / screenH) * -2 + 1 ];
}

function perpendicularFromHistory(hist: Array<{ x: number; y: number }>, a: { x: number; y: number }, b: { x: number; y: number }): [number, number] {
  if (hist.length >= 3) {
    const p_a = hist[hist.length - 3]; // previous of previous
    const p_b = a; // previous
    const p_c = b; // current
    let ab_dx = p_b.x - p_a.x, ab_dy = p_b.y - p_a.y;
    let ab_dist = Math.hypot(ab_dx, ab_dy) || 1;
    const ab_nx = ab_dx / ab_dist, ab_ny = ab_dy / ab_dist;
    let bc_dx = p_c.x - p_b.x, bc_dy = p_c.y - p_b.y;
    let bc_dist = Math.hypot(bc_dx, bc_dy) || 1;
    const bc_nx = bc_dx / bc_dist, bc_ny = bc_dy / bc_dist;
    let bis_x = ab_nx + bc_nx, bis_y = ab_ny + bc_ny;
    let bis_dist = Math.hypot(bis_x, bis_y);
    if (bis_dist < 0.001) { return [-ab_ny, ab_nx]; }
    return [-bis_y / bis_dist, bis_x / bis_dist];
  } else {
    let dx = b.x - a.x, dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.001) return [1, 0];
    return [-dy / dist, dx / dist];
  }
}

function buildTrapezoids(points: Array<{ x: number; y: number; p?: number; t?: number }>) {
  // Dynamic arrays for this batch
  const posArr: number[] = [];
  const colArr: number[] = [];
  const idxArr: number[] = [];
  let baseVertex = 0;

  for (let i = 0; i < points.length; i++) {
  const raw = points[i];
  const cur = { x: raw.x, y: raw.y, p: raw.p ?? 0.5, t: raw.t ?? performance.now() };
    const prev = pointHistory.length > 0 ? pointHistory[pointHistory.length - 1] : null;

    // maintain history (cap 3)
    pointHistory.push(cur);
    if (pointHistory.length > 3) pointHistory.shift();

    if (!prev) {
      // First point, cannot form segment yet
      continue;
    }

    // Compute perpendicular at 'cur' using bisector (or simple when <3)
    const [px, py] = perpendicularFromHistory(pointHistory, prev, cur);
    const bp = cur.p ?? 0.5;
    let speedFactor = 1.0;
    if (sizeFromSpeed && prev) {
      const dt = Math.max(1, cur.t - prev.t);
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const v = dist / dt; // px/ms
      const vNorm = Math.max(0, Math.min(1, v / 2)); // cap at 2 px/ms
      const minFactor = 1 - 0.8 * speedInfluence;
      speedFactor = 1 + (minFactor - 1) * vNorm; // lerp(1, minFactor, vNorm)
    }
    const bWidth = (brushSize * bp * speedFactor) * 0.5;
    const curL: [number, number] = [cur.x + px * bWidth, cur.y + py * bWidth];
    const curR: [number, number] = [cur.x - px * bWidth, cur.y - py * bWidth];

    if (prevLeft && prevRight) {
      const [alx, aly] = prevLeft;
      const [arx, ary] = prevRight;
      const [blx, bly] = curL;
      const [brx, bry] = curR;

      const [calx, caly] = toClip(alx, aly);
      const [carx, cary] = toClip(arx, ary);
      const [cblx, cbly] = toClip(blx, bly);
      const [cbrx, cbry] = toClip(brx, bry);

      // positions (AL, AR, BL, BR)
      posArr.push(calx, caly, carx, cary, cblx, cbly, cbrx, cbry);
      // colors (same for 4 vertices)
      for (let k = 0; k < 4; k++) {
        colArr.push(colorRGB[0], colorRGB[1], colorRGB[2], Math.max(0, Math.min(1, baseAlpha)));
      }
      // indices for two triangles
      idxArr.push(baseVertex + 0, baseVertex + 1, baseVertex + 2, baseVertex + 1, baseVertex + 3, baseVertex + 2);
      baseVertex += 4;
    }

    // Update previous edges for next segment
    prevLeft = curL;
    prevRight = curR;
  }

  if (posArr.length === 0) return null;
  return {
    pos: new Float32Array(posArr),
    col: new Float32Array(colArr),
    idx: new Uint16Array(idxArr),
  };
}

self.onmessage = (ev: MessageEvent<GeomMsgIn>) => {
  const msg = ev.data;
  if (!msg) return;
  if (msg.type === 'init') {
    screenW = Math.max(1, msg.width | 0);
    screenH = Math.max(1, msg.height | 0);
    (self as any).postMessage({ type: 'log', msg: 'geom worker initialized' } satisfies GeomMsgOut);
    return;
  }
  if (msg.type === 'params') {
    brushSize = msg.size;
    baseAlpha = msg.alpha;
    colorRGB = msg.colorRGB;
    if (typeof msg.sizeFromSpeed !== 'undefined') sizeFromSpeed = !!msg.sizeFromSpeed;
    if (typeof msg.speedInfluence === 'number') speedInfluence = Math.max(0, Math.min(1, msg.speedInfluence));
    return;
  }
  if (msg.type === 'reset') {
    pointHistory = [];
    prevLeft = null;
    prevRight = null;
    return;
  }
  if (msg.type === 'points') {
    const built = buildTrapezoids(msg.points);
    if (!built) return;
    // Transfer the buffers to avoid copies
    (self as any).postMessage(
      { type: 'geometry', positions: built.pos, colors: built.col, indices: built.idx } satisfies GeomMsgOut,
      [built.pos.buffer, built.col.buffer, built.idx.buffer]
    );
    return;
  }
};
