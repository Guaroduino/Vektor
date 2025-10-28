// VKTOR: Modular application orchestrator

import {
  Application,
  Container,
  Shader,
  extensions,
  TickerPlugin,
  EventSystem,
} from 'pixi.js';
import 'pixi.js/mesh';
import './style.css';

import { vertexSrc, fragmentSrc } from './shaders';
import { getPointData, calculatePerpendicular } from './input';
import { MeshManager } from './mesh';
import { setupControls as wireControls } from './controls';

export class VektorApp {
  private app: Application;
  private sceneContainer: Container;

  private isDrawing = false;
  private pointHistory: number[][] = [];
  private prevLeftPoint: [number, number] | null = null;
  private prevRightPoint: [number, number] | null = null;

  private meshShader: InstanceType<typeof Shader>;
  private meshManager!: MeshManager;

  // Brush params
  public size: number = 16;
  public segmentAlpha: number = 0.1;
  public simulatePressure: boolean = true;
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

    const canvas = (this.app as any).view ?? (this.app as any).canvas;
    if (canvas) document.body.appendChild(canvas as HTMLCanvasElement);

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

    wireControls(this);

    this.meshManager = new MeshManager(this.app, this.sceneContainer, this.meshShader);
    this.meshManager.init(256);

    this.app.stage.on('pointerdown', this.handlePointerDown.bind(this));
    this.app.stage.on('pointermove', this.handlePointerMove.bind(this));
    this.app.stage.on('pointerup', this.handlePointerUp.bind(this));
    this.app.stage.on('pointerupoutside', this.handlePointerUp.bind(this));
  }

  private handlePointerDown = (event: any) => {
    this.isDrawing = true;
    this.pointHistory = [];
    this.prevLeftPoint = null;
    this.prevRightPoint = null;
    const firstPoint = getPointData(event);
    this.pointHistory.push(firstPoint);
  };

  private handlePointerMove = (event: any) => {
    if (!this.isDrawing) return;

    const nativeEv = event.nativeEvent as MouseEvent | PointerEvent;
    const coalescedEvents: Array<MouseEvent | PointerEvent> =
      typeof (nativeEv as any).getCoalescedEvents === 'function'
        ? ((nativeEv as any).getCoalescedEvents() as Array<PointerEvent>)
        : [nativeEv];

    for (const e of coalescedEvents) {
      const curPoint = getPointData(e);
      this.pointHistory.push(curPoint);
      if (this.pointHistory.length > 3) this.pointHistory.shift();

      if (this.pointHistory.length >= 2) {
        const bIndex = this.pointHistory.length - 1;
        const aIndex = bIndex - 1;
        const a = this.pointHistory[aIndex];
        const b = this.pointHistory[bIndex];

        const [px, py] = calculatePerpendicular(this.pointHistory, a, b);
        const bp = this.simulatePressure ? b[2] ?? 0.5 : 1.0;
        const bWidth = (this.size * bp) * 0.5;
        const curL: [number, number] = [b[0] + px * bWidth, b[1] + py * bWidth];
        const curR: [number, number] = [b[0] - px * bWidth, b[1] - py * bWidth];

        if (this.prevLeftPoint && this.prevRightPoint) {
          this.meshManager.drawSegment(this.prevLeftPoint, this.prevRightPoint, curL, curR, this.colorRGB, this.segmentAlpha);
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

  public clearCanvas() {
    this.meshManager.clear();
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
}

