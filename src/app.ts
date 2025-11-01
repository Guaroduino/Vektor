// VKTOR: Modular application orchestrator

import {
  Application,
  Container,
  Shader,
  extensions,
  TickerPlugin,
  EventSystem,
} from 'pixi.js';
import './style.css';

import { vertexSrc, fragmentSrc } from './shaders';
import { getPointData } from './input';
import { MeshManager } from './mesh';
import { setupControls as wireControls } from './controls';
import ToolManager from './core/ToolManager';
import { VectorPencilTool } from './tools/vectorPencil';
import { RasterBrushTool } from './tools/rasterBrush';
import type { ToolParams, ToolPointerEvent, ToolContext } from './core/interfaces';
import LayerManager from './core/LayerManager';

export class VektorApp {
  private app: Application;
  private sceneContainer: Container;

  private meshShader: InstanceType<typeof Shader>;
  private layerManager!: LayerManager;
  private meshManager!: MeshManager;
  private toolManager?: ToolManager;

  // Brush params
  public size: number = 16;
  public segmentAlpha: number = 0.1;
  public simulatePressure: boolean = true;
  public sizeFromSpeed: boolean = false;
  public speedInfluence: number = 0.5; // 0..1, how much fast speed thins the stroke
  public colorRGB: [number, number, number] = [1, 1, 1];
  public colorHex: string = '#ffffff';
  public bgColorHex: string = '#1a1a1a';

  constructor() {
    this.app = new Application();
    this.sceneContainer = new Container();
    this.meshShader = Shader.from({ gl: { vertex: vertexSrc, fragment: fragmentSrc } });
    void this.setup();
  }

  private async setup() {
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

  // En Pixi v8 el canvas público es `app.canvas`
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

  extensions.add(TickerPlugin);
  extensions.add(EventSystem);

  this.layerManager = new LayerManager(this.app, this.sceneContainer, this.meshShader);
    this.layerManager.init(256);
    // Ensure we also have a raster layer present (below vector)
    this.layerManager.ensureRasterLayer();
    this.meshManager = this.layerManager.getActiveMesh();

    // Initialize ToolManager with default tool (non-invasive placeholder)
    const makeToolContext = (): ToolContext => ({
      width: this.app.screen.width,
      height: this.app.screen.height,
      toClipSpace: (x: number, y: number) => {
        // Convert CSS pixel coordinates to clip space (-1..1)
        const cx = (x / this.app.screen.width) * 2 - 1;
        const cy = (y / this.app.screen.height) * -2 + 1;
        return { cx, cy };
      },
    });
    const initialParams: ToolParams = {
      size: this.size,
      alpha: this.segmentAlpha,
      colorRGB: this.colorRGB,
      blend: 'normal',
      sizeFromSpeed: this.sizeFromSpeed,
      speedInfluence: this.speedInfluence,
    };
  this.toolManager = new ToolManager(makeToolContext(), initialParams);
  this.toolManager.register(new VectorPencilTool(this.meshManager, { useWorker: true }));
  this.toolManager.register(new RasterBrushTool(this.layerManager));
    this.toolManager.useTool('vector-pencil');

  // Wire UI controls after mesh and (optionally) worker are ready
    wireControls(this);

    this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
    this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
    this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
    this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));

    // Note: ToolManager context refresh on resize will be introduced when migrating tools
  }

  private handlePointerDown = (event: any) => {
    // Forward to ToolManager
    this.toolManager?.handlePointer(this.toToolPointer('down', event));
  };

  private handlePointerMove = (event: any) => {
    // Forward to ToolManager
    this.toolManager?.handlePointer(this.toToolPointer('move', event));
  };

  private handlePointerUp = () => {
    // Forward to ToolManager
    this.toolManager?.handlePointer({ type: 'up', x: 0, y: 0 });
  };

  public clearCanvas() {
    // Clear active tool output
    this.toolManager?.clear();
  }

  public setBlendMode(mode: 'add' | 'normal' | 'multiply') {
    // Apply blend to active layer (vector mesh or raster sprite)
    this.layerManager.setBlendMode(mode);
  }

  public updateWorkerParams() {
    // Sync params to ToolManager
    this.toolManager?.setParams({
      size: this.size,
      alpha: this.segmentAlpha,
      colorRGB: this.colorRGB,
      sizeFromSpeed: this.sizeFromSpeed,
      speedInfluence: this.speedInfluence,
    });
  }

  // Switch active tool by id from controls
  public setTool(id: string) {
    console.log('[App] setTool', id);
    this.toolManager?.useTool(id);
    // Push current params to the newly activated tool so it picks up sliders
    this.updateWorkerParams();
    // Switch active layer to match tool
    if (id === 'vector-pencil') this.layerManager.setActiveById('vector-1');
    if (id === 'raster-brush') this.layerManager.setActiveById('raster-1');
  }

  // Layer panel helpers
  public getLayers() {
    return this.layerManager.list();
  }
  public setActiveLayer(id: string, typeHint?: 'vector'|'raster') {
    console.log('[App] setActiveLayer', id, typeHint);
    this.layerManager.setActiveById(id);
    // switch tool to match layer type for coherent UX
    if (typeHint === 'vector') this.setTool('vector-pencil');
    else if (typeHint === 'raster') this.setTool('raster-brush');
  }
  public setLayerVisible(id: string, visible: boolean) {
    this.layerManager.setVisible(id, visible);
  }

  public saveToFile() {
    const data = this.meshManager.saveToObject();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = this.timestamp();
    a.href = url;
    a.download = `vektor-${timestamp}.vektor.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  public onLoadFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        this.meshManager.loadFromObject(obj);
      } catch (err) {
        console.error('Invalid file format', err);
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  public async exportPNG() {
    try {
      const renderer: any = (this.app as any).renderer;
      renderer.render(this.app.stage);
      const sourceCanvas = (this.app as any).canvas as HTMLCanvasElement;
      if (sourceCanvas && sourceCanvas.width && sourceCanvas.height) {
        const out = document.createElement('canvas');
        out.width = sourceCanvas.width;
        out.height = sourceCanvas.height;
        const ctx = out.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceCanvas, 0, 0);
          const dataUrl = out.toDataURL('image/png');
          if (dataUrl) this.triggerDownload(dataUrl, `vektor-${this.timestamp()}.png`);
        }
      }
    } catch (e) {
      console.error('PNG export failed', e);
    }
  }

  public async exportJPG() {
    try {
      const sourceCanvas = this.app.canvas as HTMLCanvasElement | OffscreenCanvas | null;
      if (sourceCanvas && (sourceCanvas as any).width && (sourceCanvas as any).height) {
        const out = document.createElement('canvas');
        out.width = (sourceCanvas as any).width;
        out.height = (sourceCanvas as any).height;
        const ctx = out.getContext('2d');
        if (ctx) {
          ctx.fillStyle = this.bgColorHex || '#000000';
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(sourceCanvas as any, 0, 0);
          const dataUrl = out.toDataURL('image/jpeg', 0.92);
          if (dataUrl) this.triggerDownload(dataUrl, `vektor-${this.timestamp()}.jpg`);
        }
      }
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

  private toToolPointer(type: 'down'|'move'|'up'|'cancel', event: any): ToolPointerEvent {
    const [x, y, p] = getPointData(event);
    const pressure = this.simulatePressure ? (p ?? 0.5) : 1.0;
    const t = (event?.nativeEvent as any)?.timeStamp ?? performance.now();
    return { type, x, y, pressure, timeStamp: t } as any;
  }
}

