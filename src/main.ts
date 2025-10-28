// VKTOR: Arquitectura "Triangle Strip" (Namespace + Bind FIX v3)
console.log('--- VektorApp main.ts (namespace-bind-fix-v3) Cargado ---');

// Use named imports from pixi.js v8 for proper typing
import {
  Application,
  Container,
  Shader,
  Geometry,
  Mesh,
  State,
  extensions,
  TickerPlugin,
  EventSystem,
} from 'pixi.js';
// Note: use a loose event type here to avoid value/type import mismatch for
// FederatedPointerEvent; we narrow at runtime in getPointData.
// Ensure mesh/geometry runtime code is loaded (some sub-exports register implementations)
import 'pixi.js/mesh';
import './style.css';

// (plugins registered later during app init)

// --- Simple Shaders for Vertex Colors ---
const vertexSrc = `
  precision mediump float;
  attribute vec2 aPosition;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    // aPosition is provided in clip space already [-1,1]
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }`;

const fragmentSrc = `
  precision mediump float;
  varying vec4 vColor;
  void main() {
    // Modulate emitted RGB by alpha so the slider affects intensity
    gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a);
  }`;
// ----------------------------------------

/**
 * Clase principal que inicializa el motor gráfico de Vektor.
 */
class VektorApp {
  // VKTOR: Usamos InstanceType para TODOS los tipos de Pixi
  private app: Application;
  private sceneContainer: Container;
  // No necesitamos brushLayer

  private isDrawing = false;
  private pointHistory: Array<number[]> = [];
  private prevLeftPoint: [number, number] | null = null;
  private prevRightPoint: [number, number] | null = null;

  private meshShader: InstanceType<typeof Shader>;
  // Single-mesh drawing buffers
  private geometry!: InstanceType<typeof Geometry>;
  private mesh!: InstanceType<typeof Mesh>;
  private posBuffer!: Float32Array;
  private colorBuffer!: Float32Array;
  private indexBuffer!: Uint16Array;
  private segmentCapacity = 0; // in segments (each segment adds 4 verts, 6 indices)
  private vertCount = 0; // number of floats used in position buffer (2 per vertex)
  private colorCount = 0; // number of floats used in color buffer (4 per vertex)
  private indexCount = 0; // number of indices used

  // Parámetros del pincel
  private size: number = 16;
  private segmentAlpha: number = 0.1;
  private simulatePressure: boolean = true;
  // Brush color (linear in 0..1)
  private colorRGB: [number, number, number] = [1, 1, 1];
  private colorHex: string = '#ffffff';
  private bgColorHex: string = '#1a1a1a';

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
    // Create a WebGL-compatible shader using the v8 API
    this.meshShader = Shader.from({
      gl: { vertex: vertexSrc, fragment: fragmentSrc },
    });
    this.setup();
  }

  /**
   * Configura las propiedades principales de la aplicación Pixi.
   */
  private async setup() {
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      // Ensure exports via toDataURL/drawImage see the latest pixels
      // (cast to any to avoid TS complaints in Pixi v8 typings)
      preserveDrawingBuffer: true as any,
    });

    document.body.appendChild(this.app.canvas as HTMLCanvasElement);

    try {
      if (this.app.canvas instanceof HTMLCanvasElement) {
        (this.app.canvas as HTMLCanvasElement).style.touchAction = 'none';
        (this.app.canvas as HTMLCanvasElement).style.userSelect = 'none';
      }
    } catch (e) { /* no-op */ }

  this.app.stage.eventMode = 'static';
  this.app.stage.hitArea = this.app.screen;

    this.app.stage.addChild(this.sceneContainer);

  // Register plugins using the named exports
  extensions.add(TickerPlugin);
  extensions.add(EventSystem);

  // Ensure these handlers are bound to this
  this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
  this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
  this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
  this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));

    console.log('Vektor Engine Inicializado. Modo Mesh (Namespace + Bind Fix).');
    this.setupControls();

    // Initialize single mesh with some initial capacity
    this.initSingleMesh(256); // ~256 segments to start
  }

  // Allocate single-quad mesh resources and add to scene
  private initSingleMesh(initialSegments: number) {
    this.segmentCapacity = Math.max(16, initialSegments | 0);
    const vertCapacity = this.segmentCapacity * 4; // 4 verts per segment
    const posCapacityFloats = vertCapacity * 2; // x,y
    const colorCapacityFloats = vertCapacity * 4; // r,g,b,a
    const indexCapacity = this.segmentCapacity * 6; // 6 indices per segment

    this.posBuffer = new Float32Array(posCapacityFloats);
    this.colorBuffer = new Float32Array(colorCapacityFloats);
    this.indexBuffer = new Uint16Array(indexCapacity);
    this.vertCount = 0;
    this.colorCount = 0;
    this.indexCount = 0;

    const geom = new Geometry();
    geom.addAttribute('aPosition', this.posBuffer, 2);
    geom.addAttribute('aColor', this.colorBuffer, 4);
    geom.addIndex(this.indexBuffer);
    this.geometry = geom;

    this.mesh = new Mesh({ geometry: this.geometry, shader: this.meshShader });
    const state = new State();
    state.blendMode = 'add';
    this.mesh.state = state;
    this.sceneContainer.addChild(this.mesh);
  }

  // Ensure buffers can hold N more segments; if not, reallocate and swap geometry
  private ensureCapacity(extraSegments: number) {
    const usedSegments = this.indexCount / 6 | 0;
    const needed = usedSegments + extraSegments;
    if (needed <= this.segmentCapacity) return;

    let newCapacity = this.segmentCapacity;
    while (newCapacity < needed) newCapacity *= 2;

    const newVertCapacity = newCapacity * 4;
    const newPosFloats = newVertCapacity * 2;
    const newColorFloats = newVertCapacity * 4;
    const newIndexCapacity = newCapacity * 6;

    const newPos = new Float32Array(newPosFloats);
    newPos.set(this.posBuffer.subarray(0, this.vertCount));
    const newCol = new Float32Array(newColorFloats);
    newCol.set(this.colorBuffer.subarray(0, this.colorCount));
    const newIdx = new Uint16Array(newIndexCapacity);
    newIdx.set(this.indexBuffer.subarray(0, this.indexCount));

    this.segmentCapacity = newCapacity;
    this.posBuffer = newPos;
    this.colorBuffer = newCol;
    this.indexBuffer = newIdx;

    // Rebuild geometry and swap on mesh
    const newGeom = new Geometry();
    newGeom.addAttribute('aPosition', this.posBuffer, 2);
    newGeom.addAttribute('aColor', this.colorBuffer, 4);
    newGeom.addIndex(this.indexBuffer);
    this.mesh.geometry = newGeom;
    this.geometry = newGeom;
  }

  /**
   * Vincula sliders/checkbox de UI.
   */
  private setupControls() {
     // ... (tu código setupControls está perfecto) ...
     const bindRange = (id: string, initial: number, onValue: (v: number) => void, step?: number) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        const valEl = document.getElementById(id + 'Val') as HTMLElement | null;
        if (!el) return;
        el.value = String(initial);
        if (step) el.step = String(step);
        if (valEl) valEl.textContent = String(initial.toFixed(step ? 2 : 0));
        const update = () => {
            const v = parseFloat(el.value);
            if (!Number.isFinite(v)) return;
            onValue(v);
            if (valEl) valEl.textContent = String(v.toFixed(step ? 2 : 0));
        };
        el.addEventListener('input', update);
    };
    const bindCheckbox = (id: string, initial: boolean, onValue: (v: boolean) => void) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) return;
        el.checked = initial;
        const update = () => onValue(el.checked);
        el.addEventListener('change', update);
    };
    bindRange('size', this.size, (v) => (this.size = Math.max(1, Math.round(v))));
    bindRange('alpha', this.segmentAlpha, (v) => (this.segmentAlpha = Math.min(1, Math.max(0.01, v))), 0.01);
    bindCheckbox('simulatePressure', this.simulatePressure, (v) => (this.simulatePressure = v));

    // Color picker
    const colorInput = document.getElementById('color') as HTMLInputElement | null;
    const colorVal = document.getElementById('colorVal') as HTMLElement | null;
    const updateBrushColor = (hex: string) => {
      if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
      this.colorHex = hex;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      this.colorRGB = [r, g, b];
      if (colorVal) colorVal.textContent = hex.toUpperCase();
    };
    if (colorInput) {
      colorInput.value = this.colorHex;
      updateBrushColor(this.colorHex);
      colorInput.addEventListener('input', () => updateBrushColor(colorInput.value));
      colorInput.addEventListener('change', () => updateBrushColor(colorInput.value));
    }

    // Background color picker
    const bgInput = document.getElementById('bgColor') as HTMLInputElement | null;
    const bgVal = document.getElementById('bgColorVal') as HTMLElement | null;
    const setBackground = (hex: string) => {
      if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
      this.bgColorHex = hex.toLowerCase();
      const num = parseInt(hex.slice(1), 16);
      const rAny = (this.app as any).renderer;
      if (rAny?.background) rAny.background.color = num;
      else rAny.backgroundColor = num;
      if (bgVal) bgVal.textContent = hex.toUpperCase();
      // Re-render to apply immediately
      if (rAny?.render) rAny.render(this.app.stage);
    };
    if (bgInput) {
      bgInput.value = this.bgColorHex;
      setBackground(this.bgColorHex);
      bgInput.addEventListener('input', () => setBackground(bgInput.value));
      bgInput.addEventListener('change', () => setBackground(bgInput.value));
    }

    // Clear button
    const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement | null;
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearCanvas());
    }

    // Save / Load
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
    const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement | null;
    const loadInput = document.getElementById('loadInput') as HTMLInputElement | null;
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveToFile());
    if (loadBtn && loadInput) {
      loadBtn.addEventListener('click', () => loadInput.click());
      loadInput.addEventListener('change', (e) => this.onLoadFileSelected(e));
    }

    // Export PNG / JPG
    const exportPngBtn = document.getElementById('exportPngBtn') as HTMLButtonElement | null;
    const exportJpgBtn = document.getElementById('exportJpgBtn') as HTMLButtonElement | null;
    if (exportPngBtn) exportPngBtn.addEventListener('click', () => this.exportPNG());
    if (exportJpgBtn) exportJpgBtn.addEventListener('click', () => this.exportJPG());
  }

  // --- Manejadores de Eventos (Hilo Principal) ---

  private handlePointerDown = (event: any) => {
    this.isDrawing = true;
    this.pointHistory = [];
    this.prevLeftPoint = null;
    this.prevRightPoint = null;
    const firstPoint = this.getPointData(event);
    this.pointHistory.push(firstPoint);

    // Do NOT clear previous strokes here; we want cumulative drawing
  };

  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;

    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    for (const e of coalescedEvents) {
      const curPoint = this.getPointData(e);
      this.pointHistory.push(curPoint);

      if (this.pointHistory.length > 3) {
        this.pointHistory.shift();
      }

      if (this.pointHistory.length >= 2) {
        const bIndex = this.pointHistory.length - 1;
        const aIndex = bIndex - 1;
        const a = this.pointHistory[aIndex];
        const b = this.pointHistory[bIndex];

        const [px, py] = this.calculatePerpendicular(a, b);
        const bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;
        const bWidth = (this.size * bp) * 0.5;
        const curL: [number, number] = [b[0] + px * bWidth, b[1] + py * bWidth];
        const curR: [number, number] = [b[0] - px * bWidth, b[1] - py * bWidth];

        if (this.prevLeftPoint && this.prevRightPoint) {
          this.drawMeshSegment(this.prevLeftPoint, this.prevRightPoint, curL, curR, this.segmentAlpha);
        }

        this.prevLeftPoint = curL;
        this.prevRightPoint = curR;
      }
    }
  };

  private handlePointerUp = () => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.pointHistory = [];
    this.prevLeftPoint = null;
    this.prevRightPoint = null;
  };

  // --- Lógica de Cálculo y Dibujo ---

  private calculatePerpendicular(a: number[], b: number[]): [number, number] {
      // ... (Lógica de bisectriz/normal simple - sin cambios y correcta) ...
        let px: number, py: number;
        if (this.pointHistory.length === 3) {
            const p_a = this.pointHistory[0];
            const p_c = this.pointHistory[2];
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

  /**
   * Draws a mesh segment using the PIXI namespace.
   */
  private drawMeshSegment(
    AL: [number, number], AR: [number, number],
    BL: [number, number], BR: [number, number],
    baseAlpha: number
  ) {
    // Ensure space for one more segment
    this.ensureCapacity(1);

    const alpha = Math.max(0, Math.min(1, baseAlpha));

    // Convert to clip space
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const toClip = (x: number, y: number) => [
      (x / w) * 2 - 1,
      (y / h) * -2 + 1,
    ] as [number, number];

    const [alx, aly] = toClip(AL[0], AL[1]);
    const [arx, ary] = toClip(AR[0], AR[1]);
    const [blx, bly] = toClip(BL[0], BL[1]);
    const [brx, bry] = toClip(BR[0], BR[1]);

    // Base vertex index (in number of vertices)
    const baseVertex = (this.vertCount / 2) | 0;

    // Write positions (8 floats)
    let p = this.vertCount;
    const pb = this.posBuffer;
    pb[p++] = alx; pb[p++] = aly;
    pb[p++] = arx; pb[p++] = ary;
    pb[p++] = blx; pb[p++] = bly;
    pb[p++] = brx; pb[p++] = bry;
    this.vertCount = p;

    // Write colors (16 floats)
    let c = this.colorCount;
    const cb = this.colorBuffer;
    for (let i = 0; i < 4; i++) {
      cb[c++] = this.colorRGB[0];
      cb[c++] = this.colorRGB[1];
      cb[c++] = this.colorRGB[2];
      cb[c++] = alpha;
    }
    this.colorCount = c;

    // Write indices (6)
    let ii = this.indexCount;
    const ib = this.indexBuffer;
    ib[ii++] = baseVertex + 0; ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 2;
    ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 3; ib[ii++] = baseVertex + 2;
    this.indexCount = ii;

    // Push updates to GPU
    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  /**
   * Helper para extraer y normalizar datos del puntero.
   */
  private getPointData = (event: any | PointerEvent | MouseEvent): number[] => {
      // ... (Tu código getPointData está bien) ...
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
          console.warn("Unexpected event structure in getPointData:", event);
          x = 0; y = 0; pressure = 0.5;
      }
      return [x, y, pressure];
  };

  // Clear all written geometry but keep buffers allocated
  private clearCanvas() {
    this.vertCount = 0;
    this.colorCount = 0;
    this.indexCount = 0;
    this.indexBuffer.fill(0);
    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  // --- Save / Load ---
  private saveToFile() {
    const data = {
      format: 'vektor-geometry-v1',
      version: 1,
      pos: Array.from(this.posBuffer.slice(0, this.vertCount)),
      color: Array.from(this.colorBuffer.slice(0, this.colorCount)),
      index: Array.from(this.indexBuffer.slice(0, this.indexCount)),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `vektor-${timestamp}.vektor.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private onLoadFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        this.loadFromJSON(obj);
      } catch (err) {
        console.error('Invalid file format', err);
      }
      // reset input so same file can be reloaded
      input.value = '';
    };
    reader.readAsText(file);
  }

  private loadFromJSON(obj: any) {
    if (!obj || !Array.isArray(obj.pos) || !Array.isArray(obj.color) || !Array.isArray(obj.index)) {
      console.error('Missing arrays in loaded JSON');
      return;
    }
    const pos = new Float32Array(obj.pos);
    const col = new Float32Array(obj.color);
    const idx = new Uint16Array(obj.index);

    // Basic sanity checks
    if (pos.length % 2 !== 0 || col.length % 4 !== 0 || idx.length % 3 !== 0) {
      console.error('Corrupt geometry data');
      return;
    }
    const neededSegments = (idx.length / 6) | 0;

    // Reset counts and ensure capacity
    this.vertCount = 0;
    this.colorCount = 0;
    this.indexCount = 0;
    this.ensureCapacity(neededSegments);

    // Copy into buffers
    this.posBuffer.set(pos, 0);
    this.colorBuffer.set(col, 0);
    this.indexBuffer.set(idx, 0);
    this.vertCount = pos.length;
    this.colorCount = col.length;
    this.indexCount = idx.length;

    // Push updates to GPU
    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  // --- Export ---
  private exportPNG() {
    try {
      // Ensure latest frame, then use Pixi's extract (works with WebGL/WebGPU)
      const renderer = (this.app as any).renderer;
      renderer.render(this.app.stage);
      const ex = renderer?.extract;
      let srcCanvas: HTMLCanvasElement = ex?.canvas ? ex.canvas(this.app.stage) : (this.app.canvas as HTMLCanvasElement);
      // Fallback: copy to a 2D canvas to avoid black frames on some GPUs
      const out = document.createElement('canvas');
      out.width = srcCanvas.width;
      out.height = srcCanvas.height;
      const ctx = out.getContext('2d');
      if (ctx) ctx.drawImage(srcCanvas, 0, 0);
      const url = (out || srcCanvas).toDataURL('image/png');
      this.triggerDownload(url, `vektor-${this.timestamp()}.png`);
    } catch (e) {
      console.error('PNG export failed', e);
    }
  }

  private exportJPG() {
    try {
      const renderer = (this.app as any).renderer;
      renderer.render(this.app.stage);
      const ex = renderer?.extract;
      let srcCanvas: HTMLCanvasElement = ex?.canvas ? ex.canvas(this.app.stage) : (this.app.canvas as HTMLCanvasElement);
      // Composite onto white to avoid black background in JPEG
      const out = document.createElement('canvas');
      out.width = srcCanvas.width;
      out.height = srcCanvas.height;
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(srcCanvas, 0, 0);
      }
      const url = (out || srcCanvas).toDataURL('image/jpeg', 0.92);
      this.triggerDownload(url, `vektor-${this.timestamp()}.jpg`);
    } catch (e) {
      console.error('JPG export failed', e);
    }
  }

  private triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  private timestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

} // End of VektorApp class

// Iniciar la aplicación
new VektorApp();