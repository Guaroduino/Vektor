// UI bindings for Vektor. Accepts a host object and wires DOM controls to it.
export function setupControls(host: any) {
  // Layers panel
  const layersPanel = document.getElementById('layersPanel');
  const renderLayers = () => {
    if (!layersPanel || typeof host.getLayers !== 'function') return;
    const layers = host.getLayers();
    layersPanel.innerHTML = '';
    const groupName = 'activeLayerGroup';
    for (const layer of layers) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';

      // Active radio
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = groupName;
      radio.checked = !!layer.isActive;
      radio.addEventListener('change', () => {
        host.setActiveLayer(layer.id, layer.type);
        // also update tool select UI to reflect automatic tool switch
        const toolSel = document.getElementById('toolSelect') as HTMLSelectElement | null;
        if (toolSel) {
          toolSel.value = layer.type === 'vector' ? 'vector-pencil' : 'raster-brush';
        }
        renderLayers();
      });

      // Visibility checkbox
      const vis = document.createElement('input');
      vis.type = 'checkbox';
      vis.checked = !!layer.visible;
      vis.title = 'Toggle visibility';
      vis.addEventListener('change', () => {
        host.setLayerVisible(layer.id, vis.checked);
      });

      // Label
      const label = document.createElement('span');
      label.textContent = `${layer.name} (${layer.type})`;

      row.appendChild(radio);
      row.appendChild(vis);
      row.appendChild(label);
      layersPanel.appendChild(row);
    }
  };
  renderLayers();
  // Tool selector
  const toolSel = document.getElementById('toolSelect') as HTMLSelectElement | null;
  if (toolSel && typeof host.setTool === 'function') {
    const applyTool = () => { console.log('[Controls] toolSelect', toolSel.value); host.setTool(toolSel.value); };
    applyTool();
    toolSel.addEventListener('change', applyTool);
  }
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

  bindRange('size', host.size, (v) => { host.size = Math.max(1, Math.round(v)); if (host.updateWorkerParams) host.updateWorkerParams(); });
  bindRange('alpha', host.segmentAlpha, (v) => { host.segmentAlpha = Math.min(1, Math.max(0.01, v)); if (host.updateWorkerParams) host.updateWorkerParams(); }, 0.01);
  bindCheckbox('simulatePressure', host.simulatePressure, (v) => (host.simulatePressure = v));

  const colorInput = document.getElementById('color') as HTMLInputElement | null;
  const colorVal = document.getElementById('colorVal') as HTMLElement | null;
  const updateBrushColor = (hex: string) => {
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    host.colorHex = hex;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
  host.colorRGB = [r, g, b];
  if (host.updateWorkerParams) host.updateWorkerParams();
    if (colorVal) colorVal.textContent = hex.toUpperCase();
  };
  if (colorInput) {
    colorInput.value = host.colorHex;
    updateBrushColor(host.colorHex);
    colorInput.addEventListener('input', () => updateBrushColor(colorInput.value));
    colorInput.addEventListener('change', () => updateBrushColor(colorInput.value));
  }

  const bgInput = document.getElementById('bgColor') as HTMLInputElement | null;
  const bgVal = document.getElementById('bgColorVal') as HTMLElement | null;
  const setBackground = (hex: string) => {
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    host.bgColorHex = hex.toLowerCase();
    const num = parseInt(hex.slice(1), 16);
    const renderer = (host.app as any).renderer;
    if (renderer?.background) renderer.background.color = num; // Pixi v8 API
    if (bgVal) bgVal.textContent = hex.toUpperCase();
    if (renderer?.render) renderer.render(host.app.stage);
  };
  if (bgInput) {
    bgInput.value = host.bgColorHex;
    setBackground(host.bgColorHex);
    bgInput.addEventListener('input', () => setBackground(bgInput.value));
    bgInput.addEventListener('change', () => setBackground(bgInput.value));
  }

  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement | null;
  if (clearBtn) clearBtn.addEventListener('click', () => host.clearCanvas());

  // Blend mode selector
  const blendSel = document.getElementById('blendMode') as HTMLSelectElement | null;
  if (blendSel) {
    const applyBlend = () => {
      const val = (blendSel.value || 'add') as 'add' | 'normal' | 'multiply';
      if (host.setBlendMode) host.setBlendMode(val);
    };
    applyBlend();
    blendSel.addEventListener('change', applyBlend);
  }

  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
  const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement | null;
  const loadInput = document.getElementById('loadInput') as HTMLInputElement | null;
  if (saveBtn) saveBtn.addEventListener('click', () => host.saveToFile());
  if (loadBtn && loadInput) {
    loadBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', (e) => host.onLoadFileSelected(e));
  }

  const exportPngBtn = document.getElementById('exportPngBtn') as HTMLButtonElement | null;
  const exportJpgBtn = document.getElementById('exportJpgBtn') as HTMLButtonElement | null;
  if (exportPngBtn) exportPngBtn.addEventListener('click', () => host.exportPNG());
  if (exportJpgBtn) exportJpgBtn.addEventListener('click', () => host.exportJPG());

  // Velocity-based width controls
  const sizeFromSpeed = document.getElementById('sizeFromSpeed') as HTMLInputElement | null;
  if (sizeFromSpeed) {
    sizeFromSpeed.checked = !!host.sizeFromSpeed;
    sizeFromSpeed.addEventListener('change', () => { host.sizeFromSpeed = sizeFromSpeed.checked; if (host.updateWorkerParams) host.updateWorkerParams(); });
  }
  bindRange('speedInfluence', host.speedInfluence ?? 0.5, (v) => {
    host.speedInfluence = Math.max(0, Math.min(1, v));
    if (host.updateWorkerParams) host.updateWorkerParams();
  }, 0.05);
}
