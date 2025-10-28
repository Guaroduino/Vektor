// Input helpers: normalize pointer events and compute perpendicular vector

export function getPointData(event: any | PointerEvent | MouseEvent): number[] {
  let x: number, y: number;
  let pressure: number;
  if ('global' in event && event.global) {
    x = event.global.x;
    y = event.global.y;
    pressure = event.pressure ?? 0.5;
  } else if ('x' in event && 'y' in event) {
    x = event.x;
    y = event.y;
    pressure = (event instanceof PointerEvent) ? (event.pressure ?? 0.5) : 0.5;
  } else {
    console.warn('Unexpected event structure in getPointData:', event);
    x = 0; y = 0; pressure = 0.5;
  }
  return [x, y, pressure];
}

export function calculatePerpendicular(pointHistory: number[][], a: number[], b: number[]): [number, number] {
  let px: number, py: number;
  if (pointHistory.length === 3) {
    const p_a = pointHistory[0];
    const p_c = pointHistory[2];
    let ab_dx = b[0] - p_a[0], ab_dy = b[1] - p_a[1];
    let ab_dist = Math.hypot(ab_dx, ab_dy) || 1;
    const ab_nx = ab_dx / ab_dist, ab_ny = ab_dy / ab_dist;
    let bc_dx = p_c[0] - b[0], bc_dy = p_c[1] - b[1];
    let bc_dist = Math.hypot(bc_dx, bc_dy) || 1;
    const bc_nx = bc_dx / bc_dist, bc_ny = bc_dy / bc_dist;
    let bis_x = ab_nx + bc_nx, bis_y = ab_ny + bc_ny;
    let bis_dist = Math.hypot(bis_x, bis_y);
    if (bis_dist < 0.001) { px = -ab_ny; py = ab_nx; }
    else { px = -bis_y / bis_dist; py = bis_x / bis_dist; }
  } else {
    let dx = b[0] - a[0], dy = b[1] - a[1];
    let dist = Math.hypot(dx, dy);
    if (dist < 0.001) { px = 1; py = 0; }
    else { px = -dy / dist; py = dx / dist; }
  }
  return [px, py];
}
