import type { ILayerManager } from './interfaces';
import { Application, Container, Shader, Sprite, RenderTexture, Geometry, Mesh, State } from 'pixi.js';
import { MeshManager } from '../mesh';

export type LayerType = 'vector' | 'raster';

export type VectorLayer = {
  id: string;
  name: string;
  type: 'vector';
  mesh: MeshManager;
  visible: boolean;
};

export type RasterLayer = {
  id: string;
  name: string;
  type: 'raster';
  sprite: any; // Sprite
  texture: any; // RenderTexture
  visible: boolean;
};

export type Layer = VectorLayer | RasterLayer;

export class LayerManager implements ILayerManager {
  private app: Application;
  private scene: Container;
  private shader: InstanceType<typeof Shader>;
  private layers: Layer[] = [];
  private activeIndex = 0;

  constructor(app: Application, scene: Container, shader: InstanceType<typeof Shader>) {
    this.app = app;
    this.scene = scene;
    this.shader = shader;
  }

  // Initialize with a default vector layer
  init(initialSegments = 256, name = 'Vector') {
    const mesh = new MeshManager(this.app, this.scene, this.shader);
    mesh.init(initialSegments);
  const vector: VectorLayer = { id: 'vector-1', name, type: 'vector', mesh, visible: true };
    this.layers = [vector];
    this.activeIndex = 0;
  }

  // Ensure a raster layer exists; create one if not present
  ensureRasterLayer(name = 'Raster'): RasterLayer {
    console.log('[Layers] ensureRasterLayer');
    const existing = this.layers.find(l => l.type === 'raster') as RasterLayer | undefined;
    if (existing) return existing;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const tex = (RenderTexture as any).create({ width: w, height: h });
    const spr = new (Sprite as any)({ texture: tex });
    (spr as any).x = 0; (spr as any).y = 0;
    (spr as any).width = w; (spr as any).height = h;
  // Put raster ABOVE the vector mesh so strokes are visible
  try { this.scene.addChild(spr); } catch { this.scene.addChild(spr); }
    (spr as any).visible = true;
    const raster: RasterLayer = { id: 'raster-1', name, type: 'raster', sprite: spr, texture: tex, visible: true };
    this.layers.push(raster);
    return raster;
  }

  getActive(): Layer {
    if (!this.layers.length) throw new Error('No layers initialized');
    return this.layers[this.activeIndex];
  }

  setActiveById(id: string): void {
    console.log('[Layers] setActiveById', id);
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx >= 0) this.activeIndex = idx;
  }

  setVisible(id: string, visible: boolean): void {
    const l = this.layers.find(l => l.id === id);
    if (!l) return;
    l.visible = !!visible;
    if (l.type === 'vector') l.mesh.setVisible(visible);
    if (l.type === 'raster') (l.sprite as any).visible = !!visible;
  }

  list(): Array<{ id: string; name: string; type: LayerType; visible: boolean; isActive: boolean }> {
    return this.layers.map((l, i) => ({ id: l.id, name: l.name, type: l.type, visible: !!(l as any).visible, isActive: i === this.activeIndex }));
  }

  getActiveMesh(): MeshManager {
    const l = this.getActive();
    if (l.type !== 'vector') throw new Error('Active layer is not vector');
    return l.mesh;
  }

  getVectorLayer(): VectorLayer | undefined { return this.layers.find(l => l.type === 'vector') as VectorLayer | undefined; }
  getRasterLayer(): RasterLayer | undefined { return this.layers.find(l => l.type === 'raster') as RasterLayer | undefined; }

  clearActive(): void {
    const l = this.getActive();
    if (l.type === 'vector') l.mesh.clear();
    if (l.type === 'raster') {
      // Recreate a fresh RenderTexture to clear efficiently
      const w = this.app.screen.width;
      const h = this.app.screen.height;
      const newTex = (RenderTexture as any).create({ width: w, height: h });
      (l.sprite as any).texture = newTex;
      try { l.texture?.destroy?.(true); } catch {}
      (l as any).texture = newTex;
    }
  }

  setBlendMode(mode: 'add' | 'normal' | 'multiply') {
    const l = this.getActive();
    if (l.type === 'vector') l.mesh.setBlendMode(mode);
    if (l.type === 'raster') (l.sprite as any).blendMode = mode;
  }

  // Render supplied geometry (clip-space positions, RGBA colors, indices) onto the raster render texture
  rasterizeGeometry(positions: Float32Array, colors: Float32Array, indices: Uint16Array) {
    const raster = this.layers.find(l => l.type === 'raster') as RasterLayer | undefined;
    if (!raster) return;
    const geom = new (Geometry as any)();
    geom.addAttribute('aPosition', positions, 2);
    geom.addAttribute('aColor', colors, 4);
    geom.addIndex(indices);
    const mesh = new (Mesh as any)({ geometry: geom, shader: this.shader });
    const state = new (State as any)();
    state.blendMode = (raster.sprite as any).blendMode ?? 'normal';
    mesh.state = state;
    const renderer: any = (this.app as any).renderer;
    try {
      renderer.render(mesh, { renderTexture: raster.texture, clear: false });
    } finally {
      try { mesh.destroy?.({ children: false, texture: false, baseTexture: false }); } catch {}
      try { geom.destroy?.(); } catch {}
    }
  }
}

export default LayerManager;
