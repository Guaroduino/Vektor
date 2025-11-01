import { Geometry, Mesh, State, Shader, Application, Container } from 'pixi.js';

export class MeshManager {
  private app: Application;
  private sceneContainer: Container;
  private shader: InstanceType<typeof Shader>;

  private geometry!: InstanceType<typeof Geometry>;
  private mesh!: InstanceType<typeof Mesh>;
  private posBuffer!: Float32Array;
  private colorBuffer!: Float32Array;
  private indexBuffer!: Uint16Array;
  private segmentCapacity = 0;
  private vertCount = 0;
  private colorCount = 0;
  private indexCount = 0;

  constructor(app: Application, sceneContainer: Container, shader: InstanceType<typeof Shader>) {
    this.app = app;
    this.sceneContainer = sceneContainer;
    this.shader = shader;
  }

  init(initialSegments: number) {
    this.segmentCapacity = Math.max(16, initialSegments | 0);
    const vertCapacity = this.segmentCapacity * 4;
    const posCapacityFloats = vertCapacity * 2;
    const colorCapacityFloats = vertCapacity * 4;
    const indexCapacity = this.segmentCapacity * 6;

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

    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    const state = new State();
    state.blendMode = 'add';
    this.mesh.state = state;
    this.sceneContainer.addChild(this.mesh);
  }

  ensureCapacity(extraSegments: number) {
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

    const newGeom = new Geometry();
    newGeom.addAttribute('aPosition', this.posBuffer, 2);
    newGeom.addAttribute('aColor', this.colorBuffer, 4);
    newGeom.addIndex(this.indexBuffer);
    this.mesh.geometry = newGeom;
    this.geometry = newGeom;
  }

  drawSegment(AL: [number, number], AR: [number, number], BL: [number, number], BR: [number, number], colorRGB: [number, number, number], baseAlpha: number) {
    this.ensureCapacity(1);
    const alpha = Math.max(0, Math.min(1, baseAlpha));

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

    const baseVertex = (this.vertCount / 2) | 0;

    let p = this.vertCount;
    const pb = this.posBuffer;
    pb[p++] = alx; pb[p++] = aly;
    pb[p++] = arx; pb[p++] = ary;
    pb[p++] = blx; pb[p++] = bly;
    pb[p++] = brx; pb[p++] = bry;
    this.vertCount = p;

    let c = this.colorCount;
    const cb = this.colorBuffer;
    for (let i = 0; i < 4; i++) {
      cb[c++] = colorRGB[0];
      cb[c++] = colorRGB[1];
      cb[c++] = colorRGB[2];
      cb[c++] = alpha;
    }
    this.colorCount = c;

    let ii = this.indexCount;
    const ib = this.indexBuffer;
    ib[ii++] = baseVertex + 0; ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 2;
    ib[ii++] = baseVertex + 1; ib[ii++] = baseVertex + 3; ib[ii++] = baseVertex + 2;
    this.indexCount = ii;

    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  // Append prebuilt geometry from a worker. Arrays must be clip-space positions and RGBA colors per vertex.
  // positions: Float32Array of length N*2; colors: Float32Array of length N*4; indices: Uint16Array of length M
  appendGeometry(positions: Float32Array, colors: Float32Array, indices: Uint16Array) {
    if (!positions.length || !indices.length) return;
    const addVerts = positions.length; // number of floats, not vertices
    const addColors = colors.length;
    const addIndices = indices.length;

    const extraSegments = (addIndices / 6) | 0;
    this.ensureCapacity(extraSegments);

    // base vertex index in terms of vertex-count (each vertex = 2 floats in pos)
    const baseVertex = (this.vertCount / 2) | 0;

    // Copy positions/colors into the big buffers
    this.posBuffer.set(positions, this.vertCount);
    this.colorBuffer.set(colors, this.colorCount);
    // Rebase incoming indices by baseVertex
    for (let i = 0; i < addIndices; i++) {
      this.indexBuffer[this.indexCount + i] = baseVertex + indices[i];
    }

    this.vertCount += addVerts;
    this.colorCount += addColors;
    this.indexCount += addIndices;

    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  clear() {
    this.vertCount = 0;
    this.colorCount = 0;
    this.indexCount = 0;
    this.indexBuffer.fill(0);
    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }

  setBlendMode(mode: 'add' | 'normal' | 'multiply') {
    if (!this.mesh?.state) return;
    this.mesh.state.blendMode = mode;
  }

  setVisible(visible: boolean) {
    if (this.mesh) (this.mesh as any).visible = !!visible;
  }

  saveToObject() {
    return {
      format: 'vektor-geometry-v1',
      version: 1,
      pos: Array.from(this.posBuffer.slice(0, this.vertCount)),
      color: Array.from(this.colorBuffer.slice(0, this.colorCount)),
      index: Array.from(this.indexBuffer.slice(0, this.indexCount)),
    };
  }

  loadFromObject(obj: any) {
    const pos = new Float32Array(obj.pos);
    const col = new Float32Array(obj.color);
    const idx = new Uint16Array(obj.index);
    if (pos.length % 2 !== 0 || col.length % 4 !== 0 || idx.length % 3 !== 0) {
      throw new Error('Corrupt geometry data');
    }
    const neededSegments = (idx.length / 6) | 0;
    this.vertCount = 0; this.colorCount = 0; this.indexCount = 0;
    this.ensureCapacity(neededSegments);
    this.posBuffer.set(pos, 0);
    this.colorBuffer.set(col, 0);
    this.indexBuffer.set(idx, 0);
    this.vertCount = pos.length;
    this.colorCount = col.length;
    this.indexCount = idx.length;
    const geomAny = this.geometry as any;
    geomAny.getAttribute('aPosition').buffer.update();
    geomAny.getAttribute('aColor').buffer.update();
    geomAny.getIndex().update();
  }
}
