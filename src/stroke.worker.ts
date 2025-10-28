// src/stroke.worker.ts
import { getStroke } from 'perfect-freehand';
// import clipping from 'polygon-clipping'; // ya no se usa en la versión por segmentos

// --- COMIENZO DE CÓDIGO PEGADO ---
// Estas funciones (rdpSimplify y sus helpers) se mueven aquí desde main.ts
// para que el worker pueda usarlas.

const rdpSimplify = (pts: number[][], eps: number): number[][] => {
  const sqDist = (p1: number[], p2: number[]) => {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  };

  const perpSqDist = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return sqDist(p, a);
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    const proj: number[] = [a[0] + t * dx, a[1] + t * dy];
    return sqDist(p, proj);
  };

  const recurse = (ptsArr: number[][], start: number, end: number, epsSq: number, out: boolean[]) => {
    let maxIdx = -1;
    let maxDist = 0;
    for (let i = start + 1; i < end; i++) {
      const d = perpSqDist(ptsArr[i], ptsArr[start], ptsArr[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > epsSq) {
      out[maxIdx] = true;
      recurse(ptsArr, start, maxIdx, epsSq, out);
      recurse(ptsArr, maxIdx, end, epsSq, out);
    }
  };

  if (pts.length < 3) return pts.slice();
  const outMask: boolean[] = new Array(pts.length).fill(false);
  outMask[0] = true;
  outMask[pts.length - 1] = true;
  recurse(pts, 0, pts.length - 1, eps * eps, outMask);
  const res: number[][] = [];
  for (let i = 0; i < pts.length; i++) if (outMask[i]) res.push(pts[i]);
  return res;
};

// --- FIN DE CÓDIGO PEGADO ---


/**
 * El manejador de mensajes principal para el worker.
 * Recibe puntos, los procesa y devuelve polígonos.
 */
self.onmessage = (event: MessageEvent) => {
  const { type, points, rdpEpsilon, options: optIn } = event.data as { type: string; points: number[][]; rdpEpsilon: number; options?: any };

  if (!points || points.length < 2) {
    if (type === 'finalize') {
      self.postMessage({ type: 'finalizeComplete', segments: [] });
    } else if (type === 'segment') {
      self.postMessage({ type: 'segmentComplete', segments: [] });
    }
    return;
  }

  // Opciones de Perfect-Freehand (desde caller o defaults)
  const options = {
    size: 16,
    thinning: 0.7,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    ...(optIn || {}),
  };

  // Procesamiento de un solo segmento (el caller decide los límites y overlap)
  const strokePolygonPoints = getStroke(points, options);
  let result: any[] = [];
  if (strokePolygonPoints.length >= 3) {
    const points2D = strokePolygonPoints.map((p: any) => [p[0], p[1]] as number[]);
    const decimated = rdpSimplify(points2D, rdpEpsilon);
    if (decimated.length >= 3) {
      // Devolvemos como MultiPolygon estándar: [ [outerRing], ...holes ]
      result = [[[...decimated]]];
    }
  }

  if (type === 'segment') {
    self.postMessage({ type: 'segmentComplete', segments: result });
  } else if (type === 'finalize') {
    self.postMessage({ type: 'finalizeComplete', segments: result });
  }
};