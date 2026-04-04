/**
 * DotArt Maker 3D — core logic
 * Handles: image processing, k-means quantization, 2D map rendering,
 * 3D unit dot preview, STL export, 3MF unit export, full project 3MF
 * (Bambu Lab format), and production manual HTML export.
 */
document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  // A. DOM references
  // ─────────────────────────────────────────────
  const el = id => document.getElementById(id);

  const imageInput      = el('imageInput');
  const sourceCanvas    = el('sourceCanvas');
  const dotCanvas       = el('dotCanvas');
  const dotPreviewCanvas = el('dotPreviewCanvas');
  const statusEl        = el('status');
  const paletteList     = el('paletteList');
  const statsEl         = el('stats');
  const geoWarning      = el('geoWarning');
  const geoWarningText  = el('geoWarningText');

  const controls = {
    dotDiameterCm: el('dotDiameterCm'),
    dotHeightCm:   el('dotHeightCm'),
    colorCount:    el('colorCount'),
    frameWidthCm:  el('frameWidthCm'),
    shapeFamily:   el('shapeFamily'),
    topStyle:      el('topStyle'),
  };

  const generateBtn        = el('generateBtn');
  const downloadMapBtn     = el('downloadMapBtn');
  const exportStlBtn       = el('exportStlBtn');
  const export3mfBtn       = el('export3mfBtn');
  const saveProjectBtn     = el('saveProjectBtn');
  const exportBaseframeBtn = el('exportBaseframeBtn');

  // ─────────────────────────────────────────────
  // B. State
  // ─────────────────────────────────────────────
  const state = {
    image: null,
    originalWidth: 0,
    originalHeight: 0,
    grid: null,
    palette: [],
    counts: [],
    cols: 0,
    rows: 0,
    frameWidthCm: 0,
    frameHeightCm: 0,
    // Crop state (normalized 0–1 in image space)
    crop: null,       // { x, y, w, h } or null = full image
    // Pan/zoom for the source canvas viewer
    view: { zoom: 1, panX: 0, panY: 0 },
  };

  // ─────────────────────────────────────────────
  // C. Utilities
  // ─────────────────────────────────────────────
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const round = (v, p = 2) => Number(v.toFixed(p));
  const mm = cm => cm * 10;
  const rgbToHex = ([r, g, b]) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  function setStatus(html) { statusEl.innerHTML = html; }


  // ─────────────────────────────────────────────
  // C2. i18n
  // ─────────────────────────────────────────────
  const LANG = {
    en: {
      nav:        { back: '← Back' },
      subtitle:   'Upload an image, configure your dot dimensions and color count, then generate your 3D dot art map. Export the unit dot in STL or 3MF, or download the full project ready for Bambu Lab slicers.',
      label:      { image: 'Image', dotDiameter: 'Dot diameter / width', dotHeight: 'Dot height', colorCount: 'Number of colors', frameWidth: 'Frame width', dotShape: 'Dot shape', topStyle: 'Top style' },
      hint:       { image: 'PNG, JPG or WebP.', frame: 'Height calculated proportionally from the image.' },
      btn:        { generate: 'Generate dot art', downloadMap: 'Download manual', saveProject: 'Save full project (.3mf)', exportStl: 'Export STL (unit dot)' },
      shape:      { circle: 'Circular', hex: 'Hexagonal', square: 'Square', triangle: 'Triangular' },
      shapeLabel: { circle: 'circular', hex: 'hexagonal', square: 'square', triangle: 'triangular' },
      top:        { flat: 'Flat', dome: 'Dome / Oval', spike: 'Spike' },
      topLabel:   { flat: 'flat', dome: 'dome/oval', spike: 'spike' },
      card:       { original: 'Original image', dotmap: 'Dot art map', preview: '3D unit dot preview', colors: 'Color summary' },
      stat:       { grid: 'Columns \u00d7 rows', totalDots: 'Total dots', frameSize: 'Frame size', unitDot: 'Unit dot' },
      palette:    { color: 'Color', dots: 'dots' },
      preview:    { drag: 'drag to rotate' },
      slider:     { cm: 'cm', color: 'color', colors: 'colors' },
      placeholder: 'Upload an image to get started',
      geo:        { triangleDome: 'Dome top on a triangular base creates unstable overhangs. Consider Flat or Spike instead.' },
      status: {
        upload:       'Upload an image to get started.',
        imageLoaded:  'Image loaded. Configure the parameters and click <strong>Generate</strong>.',
        imageError:   'Could not open this image. Please try a different file.',
        processing:   'Processing\u2026',
        gridTooLarge: 'The frame width produces a grid that is too large. Reduce the width or increase the dot diameter.',
        transparent:  'Image appears to be fully transparent.',
        done:         '<strong>Done.</strong> {cols} \u00d7 {rows} dots, {colors} colors. Export the unit dot or save the full project.',
        projectSaved: '<strong>Full project saved.</strong> {plates} plates of {bed} \u00d7 {bed} cm, up to {perPlate} dots per plate. Open in Bambu Studio or Orca Slicer \u2014 colors and plates are pre-assigned.',
        projectError: 'Could not save the full project.',
      },
    },
    'pt-BR': {
      nav:        { back: '← Voltar' },
      subtitle:   'Carregue uma imagem, configure as dimens\u00f5es dos pontos e o n\u00famero de cores, depois gere o mapa de dot art 3D. Exporte o ponto unit\u00e1rio em STL ou 3MF, ou baixe o projeto completo pronto para slicers Bambu Lab.',
      label:      { image: 'Imagem', dotDiameter: 'Di\u00e2metro / largura do ponto', dotHeight: 'Altura do ponto', colorCount: 'N\u00famero de cores', frameWidth: 'Largura do quadro', dotShape: 'Forma do ponto', topStyle: 'Estilo do topo' },
      hint:       { image: 'PNG, JPG ou WebP.', frame: 'Altura calculada proporcionalmente \u00e0 imagem.' },
      btn:        { generate: 'Gerar dot art', downloadMap: 'Baixar manual', saveProject: 'Salvar projeto completo (.3mf)', exportStl: 'Exportar STL (ponto unit\u00e1rio)' },
      shape:      { circle: 'Circular', hex: 'Hexagonal', square: 'Quadrado', triangle: 'Triangular' },
      shapeLabel: { circle: 'circular', hex: 'hexagonal', square: 'quadrado', triangle: 'triangular' },
      top:        { flat: 'Plano', dome: 'Domo / Oval', spike: 'Ponta' },
      topLabel:   { flat: 'plano', dome: 'domo/oval', spike: 'ponta' },
      card:       { original: 'Imagem original', dotmap: 'Mapa de pontos', preview: 'Pr\u00e9-visualiza\u00e7\u00e3o 3D', colors: 'Resumo de cores' },
      stat:       { grid: 'Colunas \u00d7 linhas', totalDots: 'Total de pontos', frameSize: 'Tamanho do quadro', unitDot: 'Ponto unit\u00e1rio' },
      palette:    { color: 'Cor', dots: 'pontos' },
      preview:    { drag: 'arraste para girar' },
      slider:     { cm: 'cm', color: 'cor', colors: 'cores' },
      placeholder: 'Carregue uma imagem para come\u00e7ar',
      geo:        { triangleDome: 'Topo domo em base triangular cria ressaltos inst\u00e1veis. Considere Plano ou Ponta.' },
      status: {
        upload:       'Carregue uma imagem para come\u00e7ar.',
        imageLoaded:  'Imagem carregada. Configure os par\u00e2metros e clique em <strong>Gerar</strong>.',
        imageError:   'N\u00e3o foi poss\u00edvel abrir esta imagem. Tente outro arquivo.',
        processing:   'Processando\u2026',
        gridTooLarge: 'A largura do quadro gera uma grade muito grande. Reduza a largura ou aumente o di\u00e2metro do ponto.',
        transparent:  'A imagem parece ser totalmente transparente.',
        done:         '<strong>Conclu\u00eddo.</strong> {cols} \u00d7 {rows} pontos, {colors} cores. Exporte o ponto unit\u00e1rio ou salve o projeto completo.',
        projectSaved: '<strong>Projeto salvo.</strong> {plates} placas de {bed} \u00d7 {bed} cm, at\u00e9 {perPlate} pontos por placa. Abra no Bambu Studio ou Orca Slicer \u2014 cores e placas j\u00e1 atribu\u00eddas.',
        projectError: 'N\u00e3o foi poss\u00edvel salvar o projeto completo.',
      },
    },
    es: {
      nav:        { back: '← Volver' },
      subtitle:   'Sube una imagen, configura las dimensiones de los puntos y el n\u00famero de colores, luego genera el mapa de dot art 3D. Exporta el punto unitario en STL o 3MF, o descarga el proyecto completo listo para slicers Bambu Lab.',
      label:      { image: 'Imagen', dotDiameter: 'Di\u00e1metro / ancho del punto', dotHeight: 'Altura del punto', colorCount: 'N\u00famero de colores', frameWidth: 'Ancho del marco', dotShape: 'Forma del punto', topStyle: 'Estilo de la cima' },
      hint:       { image: 'PNG, JPG o WebP.', frame: 'La altura se calcula proporcionalmente a la imagen.' },
      btn:        { generate: 'Generar dot art', downloadMap: 'Descargar manual', saveProject: 'Guardar proyecto completo (.3mf)', exportStl: 'Exportar STL (punto unitario)' },
      shape:      { circle: 'Circular', hex: 'Hexagonal', square: 'Cuadrado', triangle: 'Triangular' },
      shapeLabel: { circle: 'circular', hex: 'hexagonal', square: 'cuadrado', triangle: 'triangular' },
      top:        { flat: 'Plano', dome: 'Domo / Oval', spike: 'Punta' },
      topLabel:   { flat: 'plano', dome: 'domo/oval', spike: 'punta' },
      card:       { original: 'Imagen original', dotmap: 'Mapa de puntos', preview: 'Vista previa 3D', colors: 'Resumen de colores' },
      stat:       { grid: 'Columnas \u00d7 filas', totalDots: 'Total de puntos', frameSize: 'Tama\u00f1o del marco', unitDot: 'Punto unitario' },
      palette:    { color: 'Color', dots: 'puntos' },
      preview:    { drag: 'arrastrar para rotar' },
      slider:     { cm: 'cm', color: 'color', colors: 'colores' },
      placeholder: 'Sube una imagen para comenzar',
      geo:        { triangleDome: 'La cima domo en base triangular crea voladizos inestables. Considera Plano o Punta.' },
      status: {
        upload:       'Sube una imagen para comenzar.',
        imageLoaded:  'Imagen cargada. Configura los par\u00e1metros y haz clic en <strong>Generar</strong>.',
        imageError:   'No se pudo abrir esta imagen. Intenta con otro archivo.',
        processing:   'Procesando\u2026',
        gridTooLarge: 'El ancho del marco genera una cuadr\u00edcula demasiado grande. Reduce el ancho o aumenta el di\u00e1metro del punto.',
        transparent:  'La imagen parece ser completamente transparente.',
        done:         '<strong>\u00a1Listo!</strong> {cols} \u00d7 {rows} puntos, {colors} colores. Exporta el punto unitario o guarda el proyecto.',
        projectSaved: '<strong>Proyecto guardado.</strong> {plates} placas de {bed} \u00d7 {bed} cm, hasta {perPlate} puntos por placa. Abre en Bambu Studio u Orca Slicer \u2014 colores y placas ya asignados.',
        projectError: 'No se pudo guardar el proyecto completo.',
      },
    },
  };

  let currentLang = 'en';

  function t(path) {
    const keys = path.split('.');
    const get = obj => { let c = obj; for (const k of keys) c = c?.[k]; return c; };
    return get(LANG[currentLang]) ?? get(LANG.en) ?? path;
  }

  function tFmt(path, vals) {
    return t(path).replace(/\{(\w+)\}/g, (_, k) => String(vals[k] ?? ''));
  }

  // ─────────────────────────────────────────────
  // D. Geometric validation (RF-014)
  // ─────────────────────────────────────────────
  function checkGeometry() {
    const shape = controls.shapeFamily.value;
    const top   = controls.topStyle.value;
    const msg   = (shape === 'triangle' && top === 'dome') ? t('geo.triangleDome') : null;
    if (msg) {
      geoWarningText.textContent = ' ' + msg;
      geoWarning.classList.remove('hidden');
    } else {
      geoWarning.classList.add('hidden');
    }
  }

  // ─────────────────────────────────────────────
  // E. Image handling
  // ─────────────────────────────────────────────
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ── Crop / zoom helpers ──

  // Convert canvas pixel → normalized image coordinate (0–1)
  function canvasToNorm(cx, cy) {
    const { imgX, imgY, imgW, imgH } = getImgRect();
    return {
      nx: clamp((cx - imgX) / imgW, 0, 1),
      ny: clamp((cy - imgY) / imgH, 0, 1),
    };
  }

  // Get where the image is drawn on the canvas (with zoom+pan)
  function getImgRect() {
    const cw = sourceCanvas.width, ch = sourceCanvas.height;
    const { zoom, panX, panY } = state.view;
    const baseScale = Math.min(cw / state.originalWidth, ch / state.originalHeight);
    const scale = baseScale * zoom;
    const imgW  = state.originalWidth  * scale;
    const imgH  = state.originalHeight * scale;
    const imgX  = (cw - imgW) / 2 + panX;
    const imgY  = (ch - imgH) / 2 + panY;
    return { imgX, imgY, imgW, imgH, scale };
  }

  function renderOriginal() {
    const ctx = sourceCanvas.getContext('2d');
    const cw = sourceCanvas.width, ch = sourceCanvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = isDark() ? '#1c1c1e' : '#f0f4ff';
    ctx.fillRect(0, 0, cw, ch);
    if (!state.image) return;

    const { imgX, imgY, imgW, imgH } = getImgRect();

    // Draw image
    ctx.drawImage(state.image, imgX, imgY, imgW, imgH);

    // Grid overlay (10×10 cells)
    const GRID = 10;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < GRID; i++) {
      const x = imgX + imgW * i / GRID;
      ctx.beginPath(); ctx.moveTo(x, imgY); ctx.lineTo(x, imgY + imgH); ctx.stroke();
    }
    for (let j = 1; j < GRID; j++) {
      const y = imgY + imgH * j / GRID;
      ctx.beginPath(); ctx.moveTo(imgX, y); ctx.lineTo(imgX + imgW, y); ctx.stroke();
    }
    // Rule-of-thirds in blue
    ctx.strokeStyle = 'rgba(0,113,227,0.35)';
    ctx.lineWidth = 1;
    for (const t of [1/3, 2/3]) {
      const x = imgX + imgW * t;
      const y = imgY + imgH * t;
      ctx.beginPath(); ctx.moveTo(x, imgY); ctx.lineTo(x, imgY + imgH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(imgX, y); ctx.lineTo(imgX + imgW, y); ctx.stroke();
    }
    ctx.restore();

    // Crop rectangle
    if (state.crop) {
      const { x: nx, y: ny, w: nw, h: nh } = state.crop;
      const rx = imgX + nx * imgW, ry = imgY + ny * imgH;
      const rw = nw * imgW,        rh = nh * imgH;

      // Dim area outside crop
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(imgX, imgY, imgW, ry - imgY);                  // top
      ctx.fillRect(imgX, ry + rh, imgW, imgY + imgH - ry - rh);  // bottom
      ctx.fillRect(imgX, ry, rx - imgX, rh);                      // left
      ctx.fillRect(rx + rw, ry, imgX + imgW - rx - rw, rh);       // right

      // Crop border
      ctx.strokeStyle = '#0071e3';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(rx, ry, rw, rh);

      // Corner handles
      const hs = 8;
      ctx.fillStyle = '#fff';
      for (const [hx, hy] of [[rx,ry],[rx+rw,ry],[rx,ry+rh],[rx+rw,ry+rh]]) {
        ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs);
        ctx.strokeRect(hx - hs/2, hy - hs/2, hs, hs);
      }
      ctx.restore();
    }

    // Zoom badge
    if (state.view.zoom !== 1 || state.crop) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(8, 8, state.crop ? 148 : 72, 24, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Inter, Arial';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(state.view.zoom * 100)}%` + (state.crop ? '  ✂ Crop ativo' : ''), 14, 20);
      ctx.restore();
    }
  }

  // ── Crop interaction state ──
  let _cropDrag = null;  // { mode: 'draw'|'pan', startNX, startNY, startPanX, startPanY }

  function sourceCanvasPointerDown(e) {
    if (!state.image) return;
    e.preventDefault();
    const rect  = sourceCanvas.getBoundingClientRect();
    const scaleX = sourceCanvas.width  / rect.width;
    const scaleY = sourceCanvas.height / rect.height;
    const cx    = (e.clientX - rect.left) * scaleX;
    const cy    = (e.clientY - rect.top)  * scaleY;

    if (e.altKey || e.button === 1) {
      // Alt+drag or middle button = pan
      _cropDrag = { mode: 'pan', startCX: cx, startCY: cy,
                    startPanX: state.view.panX, startPanY: state.view.panY };
    } else {
      // Left drag = draw crop
      const { nx, ny } = canvasToNorm(cx, cy);
      _cropDrag = { mode: 'draw', startNX: nx, startNY: ny };
      state.crop = { x: nx, y: ny, w: 0, h: 0 };
    }
  }

  function sourceCanvasPointerMove(e) {
    if (!_cropDrag || !state.image) return;
    const rect  = sourceCanvas.getBoundingClientRect();
    const scaleX = sourceCanvas.width  / rect.width;
    const scaleY = sourceCanvas.height / rect.height;
    const cx    = (e.clientX - rect.left) * scaleX;
    const cy    = (e.clientY - rect.top)  * scaleY;

    if (_cropDrag.mode === 'pan') {
      state.view.panX = _cropDrag.startPanX + (cx - _cropDrag.startCX);
      state.view.panY = _cropDrag.startPanY + (cy - _cropDrag.startCY);
    } else {
      const { nx, ny } = canvasToNorm(cx, cy);
      state.crop = {
        x: Math.min(_cropDrag.startNX, nx),
        y: Math.min(_cropDrag.startNY, ny),
        w: Math.abs(nx - _cropDrag.startNX),
        h: Math.abs(ny - _cropDrag.startNY),
      };
    }
    renderOriginal();
  }

  function sourceCanvasPointerUp() {
    if (_cropDrag?.mode === 'draw' && state.crop) {
      // Discard tiny selections (< 2% of image)
      if (state.crop.w < 0.02 || state.crop.h < 0.02) state.crop = null;
    }
    _cropDrag = null;
    renderOriginal();
  }

  sourceCanvas.addEventListener('pointerdown', sourceCanvasPointerDown);
  sourceCanvas.addEventListener('pointermove', sourceCanvasPointerMove);
  sourceCanvas.addEventListener('pointerup',   sourceCanvasPointerUp);
  sourceCanvas.addEventListener('pointerleave', sourceCanvasPointerUp);
  sourceCanvas.style.cursor = 'crosshair';

  sourceCanvas.addEventListener('wheel', e => {
    if (!state.image) return;
    e.preventDefault();
    const rect  = sourceCanvas.getBoundingClientRect();
    const scaleX = sourceCanvas.width  / rect.width;
    const scaleY = sourceCanvas.height / rect.height;
    const cx    = (e.clientX - rect.left) * scaleX;
    const cy    = (e.clientY - rect.top)  * scaleY;

    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = clamp(state.view.zoom * factor, 1, 8);

    // Zoom toward cursor position
    state.view.panX = cx + (state.view.panX - cx) * (newZoom / state.view.zoom);
    state.view.panY = cy + (state.view.panY - cy) * (newZoom / state.view.zoom);
    state.view.zoom = newZoom;
    if (newZoom === 1) { state.view.panX = 0; state.view.panY = 0; }
    renderOriginal();
  }, { passive: false });

  function sampleGrid(img, cols, cropRegion) {
    // Source rectangle in image pixels
    const sx = cropRegion ? Math.round(cropRegion.x * img.width)  : 0;
    const sy = cropRegion ? Math.round(cropRegion.y * img.height) : 0;
    const sw = cropRegion ? Math.round(cropRegion.w * img.width)  : img.width;
    const sh = cropRegion ? Math.round(cropRegion.h * img.height) : img.height;

    const ratio = sh / sw;
    const rows  = Math.max(1, Math.round(cols * ratio));
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
    const data = ctx.getImageData(0, 0, cols, rows).data;
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) pixels.push([data[i], data[i + 1], data[i + 2]]);
      else pixels.push(null);
    }
    return { pixels, data, cols, rows };
  }

  // ─────────────────────────────────────────────
  // F. K-means++ quantization
  // ─────────────────────────────────────────────
  function colorDist2(a, b) {
    return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
  }

  function kmeansQuantize(pixels, k) {
    k = Math.max(1, Math.min(k, pixels.length));

    // K-means++ initialization: weight new centers by distance squared
    const centers = [];
    centers.push([...pixels[Math.floor(Math.random() * pixels.length)]]);
    for (let i = 1; i < k; i++) {
      const dists = pixels.map(p => {
        let minD = Infinity;
        for (const c of centers) { const d = colorDist2(p, c); if (d < minD) minD = d; }
        return minD;
      });
      const total = dists.reduce((s, d) => s + d, 0);
      let rand = Math.random() * total;
      let chosen = 0;
      for (let j = 0; j < dists.length; j++) {
        rand -= dists[j];
        if (rand <= 0) { chosen = j; break; }
      }
      centers.push([...pixels[chosen]]);
    }

    // Sub-sample for performance on large images (cap at 50k pixels)
    const step = pixels.length > 50000 ? Math.ceil(pixels.length / 50000) : 1;
    const sample = step === 1 ? pixels : pixels.filter((_, i) => i % step === 0);

    let assignments = new Array(pixels.length).fill(0);
    for (let iter = 0; iter < 20; iter++) {
      // Assign sample
      const sampleAssign = sample.map(p => {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const d = colorDist2(p, centers[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        return best;
      });

      // Recompute centers from sample
      const sums = centers.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < sample.length; i++) {
        const a = sampleAssign[i], p = sample[i];
        sums[a][0] += p[0]; sums[a][1] += p[1]; sums[a][2] += p[2]; sums[a][3] += 1;
      }
      let converged = true;
      for (let c = 0; c < centers.length; c++) {
        if (!sums[c][3]) continue;
        const nr = Math.round(sums[c][0] / sums[c][3]);
        const ng = Math.round(sums[c][1] / sums[c][3]);
        const nb = Math.round(sums[c][2] / sums[c][3]);
        if (Math.abs(nr - centers[c][0]) > 1 || Math.abs(ng - centers[c][1]) > 1 || Math.abs(nb - centers[c][2]) > 1)
          converged = false;
        centers[c] = [nr, ng, nb];
      }
      if (converged) break;
    }

    // Final assignment on full pixel set
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bestD = Infinity;
      const p = pixels[i];
      for (let c = 0; c < centers.length; c++) {
        const d = colorDist2(p, centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assignments[i] = best;
    }

    // Sort palette by luminance for stable numbering
    const order = centers.map((c, i) => ({ c, i, l: luminance(c) }))
                         .sort((a, b) => a.l - b.l);
    const remap = new Map(order.map((o, newIdx) => [o.i, newIdx]));
    const palette = order.map(o => o.c);
    assignments = assignments.map(a => remap.get(a));
    return { palette, assignments };
  }

  // ─────────────────────────────────────────────
  // G. 2D dot map rendering
  // ─────────────────────────────────────────────
  function renderDotMap() {
    drawDotMapOnCanvas(dotCanvas, { forExport: false });
  }

  function drawDotMapOnCanvas(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!state.grid) return;

    const { cols, rows } = state;
    const margin = options.forExport ? 36 : 18;
    const cell   = Math.min(
      (canvas.width  - margin * 2) / cols,
      (canvas.height - margin * 2) / rows
    );
    const drawW = cell * cols, drawH = cell * rows;
    const ox = (canvas.width  - drawW) / 2;
    const oy = (canvas.height - drawH) / 2;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = state.grid[y * cols + x];
        const color = state.palette[idx];
        const cx = ox + x * cell + cell / 2;
        const cy = oy + y * cell + cell / 2;
        draw2DShape(ctx, controls.shapeFamily.value, cx, cy, cell * 0.82, color);
        ctx.fillStyle = luminance(color) > 160 ? '#111827' : '#ffffff';
        ctx.font = `${Math.max(options.forExport ? 13 : 10, cell * (options.forExport ? 0.34 : 0.28))}px Inter, Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cx, cy);
      }
    }

    ctx.strokeStyle = 'rgba(15,23,42,0.12)';
    ctx.lineWidth = options.forExport ? 1.2 : 1;
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell);
      ctx.lineTo(ox + drawW, oy + y * cell);
      ctx.stroke();
    }
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, oy);
      ctx.lineTo(ox + x * cell, oy + drawH);
      ctx.stroke();
    }
  }

  function draw2DShape(ctx, family, cx, cy, size, color) {
    ctx.fillStyle = rgbToHex(color);
    ctx.beginPath();
    if (family === 'circle') {
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    } else if (family === 'square') {
      ctx.rect(cx - size / 2, cy - size / 2, size, size);
    } else if (family === 'triangle') {
      const h = size * 0.9;
      ctx.moveTo(cx, cy - h / 2);
      ctx.lineTo(cx - size / 2, cy + h / 2);
      ctx.lineTo(cx + size / 2, cy + h / 2);
      ctx.closePath();
    } else {
      // hex
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const x = cx + Math.cos(a) * size / 2;
        const y = cy + Math.sin(a) * size / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ─────────────────────────────────────────────
  // H. 3D unit dot preview — interactive renderer
  // ─────────────────────────────────────────────

  // Rotation state (Euler angles, radians)
  let previewRotX = -0.42;
  let previewRotY =  0.58;

  function rotateVertex(v, rx, ry) {
    // Rotate around Y (yaw)
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const x1 =  v[0] * cy + v[2] * sy;
    const y1 =  v[1];
    const z1 = -v[0] * sy + v[2] * cy;
    // Rotate around X (pitch)
    const cx = Math.cos(rx), sx = Math.sin(rx);
    return [x1, y1 * cx - z1 * sx, y1 * sx + z1 * cx];
  }

  function normalOf(a, b, c) {
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
    const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx/len, ny/len, nz/len];
  }

  function renderDotPreview() {
    const ctx = dotPreviewCanvas.getContext('2d');
    const W = dotPreviewCanvas.width, H = dotPreviewCanvas.height;

    // Background gradient (theme-aware)
    ctx.clearRect(0, 0, W, H);
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    if (isDark()) {
      grd.addColorStop(0, '#2c2c2e');
      grd.addColorStop(1, '#1c1c1e');
    } else {
      grd.addColorStop(0, '#f0f4ff');
      grd.addColorStop(1, '#dbeafe');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    const mesh = buildDotMesh();
    if (!mesh.vertices.length) return;

    // 1. Center mesh on its bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const [x, y, z] of mesh.vertices) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // 2. Rotate all vertices
    const rotated = mesh.vertices.map(v =>
      rotateVertex([v[0] - cx, v[1] - cy, v[2] - cz], previewRotX, previewRotY)
    );

    // 3. Compute scale to always fit canvas (fixed, never changes with spin)
    // Use original unrotated bounding sphere radius
    let maxR = 0;
    for (const v of mesh.vertices) {
      const r = Math.hypot(v[0]-cx, v[1]-cy, v[2]-cz);
      if (r > maxR) maxR = r;
    }
    const padding = 0.72; // fraction of half-canvas used
    const scale = (Math.min(W, H) / 2 * padding) / (maxR || 1);

    const px = W / 2;
    const py = H / 2 + maxR * scale * 0.05; // slight vertical center offset

    // 4. Light direction (fixed in world space, not rotating with object)
    const LX = 0.45, LY = -0.65, LZ = 0.62;
    const ll = Math.hypot(LX, LY, LZ);
    const lx = LX/ll, ly = LY/ll, lz = LZ/ll;

    // 5. Build & sort faces (painter's algorithm)
    const faces = [];
    for (const [ia, ib, ic] of mesh.faces) {
      const a = rotated[ia], b = rotated[ib], c = rotated[ic];
      const [nnx, nny, nnz] = normalOf(a, b, c);

      // Backface culling: skip faces pointing away from camera (camera is at +Z)
      if (nnz < 0) continue;

      const depth = (a[2] + b[2] + c[2]) / 3;

      // Phong-like shading: ambient + diffuse + specular highlight
      const diffuse  = Math.max(0, nnx*lx + nny*ly + nnz*lz);
      const specBase = Math.max(0, nnz); // simplified reflect along Z
      const specular = Math.pow(specBase, 24);
      const intensity = clamp(0.18 + 0.65 * diffuse + 0.22 * specular, 0, 1);

      faces.push({
        pts: [a, b, c].map(p => [px + p[0] * scale, py - p[1] * scale]),
        depth,
        intensity,
      });
    }
    faces.sort((a, b) => a.depth - b.depth);

    // 6. Drop shadow (ellipse below the object)
    const shadowY = py + maxR * scale * 0.88;
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,.10)';
    ctx.beginPath();
    ctx.ellipse(px, shadowY, maxR * scale * 0.72, maxR * scale * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 7. Draw faces
    for (const face of faces) {
      const v = Math.round(face.intensity * 255);
      ctx.fillStyle   = `rgb(${v},${v},${v})`;
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth   = 0.6;
      ctx.beginPath();
      face.pts.forEach(([fx, fy], i) => i === 0 ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 8. Info labels (bottom-left, theme-aware)
    ctx.fillStyle = isDark() ? 'rgba(245,245,247,0.6)' : 'rgba(29,29,31,0.6)';
    ctx.font = '12px Inter, Arial';
    ctx.fillText(`${labelShape(controls.shapeFamily.value)} / ${labelTop(controls.topStyle.value)}`, 14, H - 44);
    ctx.fillText(`⌀ ${round(Number(controls.dotDiameterCm.value), 1)} cm  ×  ${round(Number(controls.dotHeightCm.value), 1)} cm`, 14, H - 26);

    // 9. Drag hint (fades after first interaction)
    if (!previewInteracted) {
      ctx.fillStyle = isDark() ? 'rgba(10,132,255,0.55)' : 'rgba(0,113,227,0.45)';
      ctx.font = '12px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t('preview.drag'), W / 2, H - 10);
      ctx.textAlign = 'left';
    }
  }

  // ─────────────────────────────────────────────
  // H2. Mouse / touch rotation for preview
  // ─────────────────────────────────────────────
  let previewDragging   = false;
  let previewLastX      = 0;
  let previewLastY      = 0;
  let previewInteracted = false;

  dotPreviewCanvas.style.cursor = 'grab';

  dotPreviewCanvas.addEventListener('mousedown', e => {
    previewDragging = true;
    previewLastX = e.clientX;
    previewLastY = e.clientY;
    dotPreviewCanvas.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!previewDragging) return;
    const dx = e.clientX - previewLastX;
    const dy = e.clientY - previewLastY;
    previewLastX = e.clientX;
    previewLastY = e.clientY;
    previewRotY += dx * 0.012;
    previewRotX += dy * 0.012;
    // Clamp pitch so it doesn't flip upside-down
    previewRotX = clamp(previewRotX, -Math.PI / 2, Math.PI / 2);
    previewInteracted = true;
    renderDotPreview();
  });

  window.addEventListener('mouseup', () => {
    previewDragging = false;
    dotPreviewCanvas.style.cursor = 'grab';
  });

  // Touch support
  dotPreviewCanvas.addEventListener('touchstart', e => {
    previewDragging = true;
    previewLastX = e.touches[0].clientX;
    previewLastY = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });

  dotPreviewCanvas.addEventListener('touchmove', e => {
    if (!previewDragging) return;
    const dx = e.touches[0].clientX - previewLastX;
    const dy = e.touches[0].clientY - previewLastY;
    previewLastX = e.touches[0].clientX;
    previewLastY = e.touches[0].clientY;
    previewRotY += dx * 0.012;
    previewRotX = clamp(previewRotX + dy * 0.012, -Math.PI / 2, Math.PI / 2);
    previewInteracted = true;
    renderDotPreview();
    e.preventDefault();
  }, { passive: false });

  dotPreviewCanvas.addEventListener('touchend', () => { previewDragging = false; });

  const labelShape = v => t('shapeLabel.' + v) || v;
  const labelTop   = v => t('topLabel.' + v) || v;

  // ─────────────────────────────────────────────
  // I. Mesh building
  // ─────────────────────────────────────────────
  function makePolygon2D(family, radius) {
    if (family === 'circle') {
      const pts = [];
      for (let i = 0; i < 32; i++) {
        const a = i * Math.PI * 2 / 32;
        pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
      }
      return pts;
    }
    if (family === 'square')
      return [[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]];
    if (family === 'triangle')
      return [[0,-radius],[-radius*0.92, radius*0.8],[radius*0.92, radius*0.8]];
    // hex
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
    }
    return pts;
  }

  function triangulateCap(points, reverse = false) {
    const tris = [];
    for (let i = 1; i < points.length - 1; i++)
      tris.push(reverse ? [0, i+1, i] : [0, i, i+1]);
    return tris;
  }

  // ─── Primitive mesh builders (used by dot mesh + baseframe) ───

  function buildPrism(points, z0, z1) {
    const vertices = [], faces = [];
    const addV = (x, y, z) => { vertices.push([round(x,4), round(y,4), round(z,4)]); return vertices.length - 1; };
    const low  = points.map(([x, y]) => addV(x, y, z0));
    const high = points.map(([x, y]) => addV(x, y, z1));
    for (const [a, b, c] of triangulateCap(low,  true))  faces.push([low[a],  low[b],  low[c]]);
    for (const [a, b, c] of triangulateCap(high, false)) faces.push([high[a], high[b], high[c]]);
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      faces.push([low[i], low[j], high[j]], [low[i], high[j], high[i]]);
    }
    return { vertices, faces };
  }

  // Hollow prism (ring) — manifold by construction, no interior faces
  function buildRingPrism(outerPts, innerPts, z0, z1) {
    const vertices = [], faces = [];
    const addV = (x, y, z) => { vertices.push([round(x,4), round(y,4), round(z,4)]); return vertices.length - 1; };
    const n  = outerPts.length;
    const oL = outerPts.map(([x, y]) => addV(x, y, z0));
    const iL = innerPts.map(([x, y]) => addV(x, y, z0));
    const oH = outerPts.map(([x, y]) => addV(x, y, z1));
    const iH = innerPts.map(([x, y]) => addV(x, y, z1));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([oL[i], oL[j], iL[j]], [oL[i], iL[j], iL[i]]); // bottom annulus
      faces.push([oH[i], iH[j], oH[j]], [oH[i], iH[i], iH[j]]); // top annulus
      faces.push([oL[i], oL[j], oH[j]], [oL[i], oH[j], oH[i]]); // outer wall
      faces.push([iL[i], iH[j], iL[j]], [iL[i], iH[i], iH[j]]); // inner wall
    }
    return { vertices, faces };
  }

  function buildBoxMesh(x, y, z, w, d, h) {
    return buildPrism([[x, y], [x+w, y], [x+w, y+d], [x, y+d]], z, z + h);
  }

  function buildDotMesh() {
    const diameter = mm(clamp(Number(controls.dotDiameterCm.value), 1, 10));
    const height   = mm(clamp(Number(controls.dotHeightCm.value),   1, 10));
    const family   = controls.shapeFamily.value;
    const topStyle = controls.topStyle.value;
    const base     = makePolygon2D(family, diameter / 2);

    const vertices = [];
    const faces    = [];
    const addV = (x, y, z) => {
      vertices.push([round(x, 4), round(y, 4), round(z, 4)]);
      return vertices.length - 1;
    };

    const baseIdx = base.map(([x, y]) => addV(x, y, 0));
    for (const [a, b, c] of triangulateCap(base, true))
      faces.push([baseIdx[a], baseIdx[b], baseIdx[c]]);

    if (topStyle === 'flat') {
      const topIdx = base.map(([x, y]) => addV(x, y, height));
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length;
        faces.push([baseIdx[i], baseIdx[j], topIdx[j]]);
        faces.push([baseIdx[i], topIdx[j], topIdx[i]]);
      }
      for (const [a, b, c] of triangulateCap(topIdx, false))
        faces.push([topIdx[a], topIdx[b], topIdx[c]]);
    } else if (topStyle === 'dome') {
      const apex = addV(0, 0, height + diameter * 0.22);
      const ring = base.map(([x, y]) => addV(x, y, height));
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length;
        faces.push([baseIdx[i], baseIdx[j], ring[j]]);
        faces.push([baseIdx[i], ring[j], ring[i]]);
        faces.push([ring[i], ring[j], apex]);
      }
    } else if (topStyle === 'spike') {
      const shoulderH = height * 0.7;
      const ring = base.map(([x, y]) => addV(x, y, shoulderH));
      const apex = addV(0, 0, height + diameter * 0.34);
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length;
        faces.push([baseIdx[i], baseIdx[j], ring[j]]);
        faces.push([baseIdx[i], ring[j], ring[i]]);
        faces.push([ring[i], ring[j], apex]);
      }
    }
    return { vertices, faces };
  }

  // ─────────────────────────────────────────────
  // J. STL export
  // ─────────────────────────────────────────────
  function meshToSTL(name, mesh) {
    let out = `solid ${name}\n`;
    for (const [ia, ib, ic] of mesh.faces) {
      const a = mesh.vertices[ia], b = mesh.vertices[ib], c = mesh.vertices[ic];
      const n = normalOf(a, b, c);
      out += ` facet normal ${n[0]} ${n[1]} ${n[2]}\n`;
      out += `  outer loop\n`;
      out += `   vertex ${a[0]} ${a[1]} ${a[2]}\n`;
      out += `   vertex ${b[0]} ${b[1]} ${b[2]}\n`;
      out += `   vertex ${c[0]} ${c[1]} ${c[2]}\n`;
      out += `  endloop\n endfacet\n`;
    }
    out += `endsolid ${name}`;
    return out;
  }

  // ─────────────────────────────────────────────
  // K. 3MF unit export
  // ─────────────────────────────────────────────
  function meshTo3mfModel(mesh) {
    const verts = mesh.vertices.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('');
    const tris  = mesh.faces.map(f => `<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${verts}</vertices>
        <triangles>${tris}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
  }

  // ─────────────────────────────────────────────
  // L. ZIP / 3MF packaging helpers
  // ─────────────────────────────────────────────
  function crc32(bytes) {
    let c = ~0;
    for (let i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (~c) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31);
    const dosDate = (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    return { dosTime, dosDate };
  }

  const u16 = n => { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n, true); return a; };
  const u32 = n => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, true); return a; };

  function concatBytes(arrs) {
    const len = arrs.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }

  const enc = new TextEncoder();

  function zipStore(files) {
    const localParts = [], centralParts = [];
    let offset = 0;
    const dt = dosDateTime();
    for (const file of files) {
      const nameBytes = enc.encode(file.name);
      const dataBytes = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
      const crc = crc32(dataBytes);
      const local = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(dt.dosTime), u16(dt.dosDate),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0), nameBytes, dataBytes,
      ]);
      localParts.push(local);
      const central = concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dt.dosTime), u16(dt.dosDate),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
      ]);
      centralParts.push(central);
      offset += local.length;
    }
    const centralSize = centralParts.reduce((s, a) => s + a.length, 0);
    const end = concatBytes([
      u32(0x06054b50), u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralSize), u32(offset), u16(0),
    ]);
    return new Blob([...localParts, ...centralParts, end], {
      type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    });
  }

  function export3MF(mesh) {
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/plain"/>
  <Default Extension="json" ContentType="application/json"/>
</Types>`;
    const pkgRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
    const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/Metadata/project_settings.config" Id="rel_project_settings" Type="http://schemas.bambulab.com/package/2021/project_settings"/>
</Relationships>`;
    const projectSettings = JSON.stringify({
      from: 'project',
      name: 'project_settings',
      sparse_infill_density: '15%',
      enable_prime_tower: '0',
      version: '02.04.00.70',
    }, null, 2);
    return zipStore([
      { name: '[Content_Types].xml',              data: contentTypes },
      { name: '_rels/.rels',                      data: pkgRels },
      { name: '3D/_rels/3dmodel.model.rels',      data: modelRels },
      { name: '3D/3dmodel.model',                 data: meshTo3mfModel(mesh) },
      { name: 'Metadata/project_settings.config', data: projectSettings },
    ]);
  }

  // ─────────────────────────────────────────────
  // M. Full project 3MF (Bambu Lab format)
  // ─────────────────────────────────────────────
  function escXml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function translatedMesh(mesh, tx = 0, ty = 0, tz = 0) {
    return {
      vertices: mesh.vertices.map(([x, y, z]) => [round(x+tx, 4), round(y+ty, 4), round(z+tz, 4)]),
      faces: mesh.faces.map(f => [...f]),
    };
  }

  function mergeMeshes(meshes) {
    const vertices = [], faces = [];
    let offset = 0;
    for (const mesh of meshes) {
      vertices.push(...mesh.vertices);
      for (const f of mesh.faces) faces.push([f[0]+offset, f[1]+offset, f[2]+offset]);
      offset += mesh.vertices.length;
    }
    return { vertices, faces };
  }

  function bambuProjectSettings(colorHexes) {
    const palHex = colorHexes.map(h => h.toUpperCase());
    const fid = 'Generic PLA @BBL X1C';
    return JSON.stringify({
      from: 'project', name: 'project_settings',
      printer_model: 'Bambu Lab X1 Carbon',
      printer_settings_id: 'Bambu Lab X1 Carbon 0.4 nozzle',
      print_compatible_printers: ['Bambu Lab X1 Carbon 0.4 nozzle'],
      default_print_profile: '0.20mm Standard @BBL X1C',
      print_settings_id: '0.20mm Standard @BBL X1C',
      curr_bed_type: 'Cool Plate',
      nozzle_diameter: ['0.4'],
      enable_prime_tower: '0',
      sparse_infill_density: '15%',
      filament_colour: palHex,
      default_filament_colour: palHex,
      extruder_colour: palHex,
      filament_colour_type: palHex.map(() => '1'),
      filament_type: palHex.map(() => 'PLA'),
      filament_vendor: palHex.map(() => 'Generic'),
      filament_density: palHex.map(() => '1.24'),
      filament_diameter: palHex.map(() => '1.75'),
      filament_cost: palHex.map(() => '0'),
      filament_settings_id: palHex.map(() => fid),
      filament_ids: palHex.map((_, i) => `DOTART-${i+1}`),
      filament_map: palHex.map((_, i) => String(i+1)),
      default_filament_profile: palHex.map(() => fid),
      inherits_group: Array(palHex.length + 2).fill(''),
      different_settings_to_system: [
        'enable_prime_tower',
        ...palHex.map(() => 'filament_colour;filament_ids;filament_settings_id;filament_type'),
      ],
      version: '02.04.00.70',
    }, null, 2);
  }

  function bambuSliceInfo(plates, colorHexes) {
    const colorNodes = colorHexes.map((hex, i) =>
      `  <filament id="${i+1}" name="Color ${i+1}" color="${hex.toUpperCase()}" type="PLA"/>`
    ).join('\n');
    const plateNodes = plates.map((plate, idx) => {
      const objs = plate.objectIds.map((oid, n) =>
        `    <object identify_id="${oid}" name="${escXml(plate.name)}_${n+1}" skipped="false"/>`
      ).join('\n');
      return `  <plate index="${idx+1}" name="${escXml(plate.name)}">\n${objs}\n  </plate>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<slice_info app="DotArt Maker 3D" version="5.5">
${colorNodes}
${plateNodes}
</slice_info>`;
  }

  function bambuModelSettings(plates, colorHexes) {
    const allFilamentMaps = colorHexes.map((_, i) => String(i+1)).join(',');
    const plateNodes = plates.map((plate, idx) => {
      const instances = plate.objectIds.map(oid => `    <model_instance>
      <metadata key="object_id" value="${oid}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>`).join('\n');
      return `  <plate>
    <metadata key="plater_id" value="${idx+1}"/>
    <metadata key="index" value="${idx+1}"/>
    <metadata key="plater_name" value="${escXml(plate.name)}"/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <metadata key="filament_maps" value="${allFilamentMaps}"/>
${instances}
  </plate>`;
    }).join('\n');
    const objectNodes = plates.flatMap(plate => plate.items.map(item => {
      const hex = colorHexes[item.colorIndex].toUpperCase();
      return `  <object id="${item.objectId}">
    <metadata key="name" value="${escXml(item.name)}"/>
    <metadata key="extruder" value="${item.colorIndex + 1}"/>
    <metadata key="paint_color" value="${hex}"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${escXml(item.name)}"/>
      <metadata key="extruder" value="${item.colorIndex + 1}"/>
      <metadata key="paint_color" value="${hex}"/>
      <metadata key="source_object_id" value="${item.objectId}"/>
      <metadata key="source_volume_id" value="0"/>
    </part>
  </object>`;
    })).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<config>
${plateNodes}
${objectNodes}
</config>`;
  }

  function meshTo3mfModelColored(objects, colorHexes) {
    const colorTags = colorHexes.map((hex, i) =>
      `<m:color id="${i+1}" color="${hex.toUpperCase()}FF"/>`
    ).join('');
    const resources = [`<m:colorgroup id="1">${colorTags}</m:colorgroup>`];
    const buildItems = [];
    const plateRecords = [];
    let nextId = 2;

    for (const obj of objects) {
      const assemblyId = nextId++;
      const meshId     = nextId++;
      const verts  = obj.mesh.vertices.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('');
      const paint  = colorHexes[obj.colorIndex].toUpperCase();
      const ci     = obj.colorIndex;
      const tris   = obj.mesh.faces.map(f =>
        `<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}" pid="1" p1="${ci}" p2="${ci}" p3="${ci}"/>`
      ).join('');
      resources.push(
        `<object id="${meshId}" type="model" name="${escXml(obj.name)}_mesh"><metadata name="paint_color">${paint}</metadata><metadata name="extruder">${ci+1}</metadata><mesh><vertices>${verts}</vertices><triangles>${tris}</triangles></mesh></object>`
      );
      resources.push(
        `<object id="${assemblyId}" type="model" name="${escXml(obj.name)}"><metadata name="paint_color">${paint}</metadata><metadata name="extruder">${ci+1}</metadata><components><component objectid="${meshId}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object>`
      );
      buildItems.push(`<item objectid="${assemblyId}"/>`);
      const pi = (obj.plateIndex || 1) - 1;
      if (!plateRecords[pi])
        plateRecords[pi] = { name: obj.plateName || `Plate ${obj.plateIndex}`, objectIds: [], items: [] };
      plateRecords[pi].objectIds.push(assemblyId);
      plateRecords[pi].items.push({ objectId: assemblyId, name: obj.name, colorIndex: ci });
    }

    const cleanedPlates = plateRecords.filter(Boolean);
    const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" requiredextensions="m">
  <metadata name="Application">BambuStudio-02.05.00.66</metadata>
  <metadata name="BambuStudio:3mfVersion">2</metadata>
  <metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>
  <metadata name="Description">Full DotArt project — 25x25 cm plates, grouped by color</metadata>
  <resources>${resources.join('')}</resources>
  <build>${buildItems.join('')}</build>
</model>`;

    return {
      modelXml,
      plates: cleanedPlates,
      modelSettingsXml:   bambuModelSettings(cleanedPlates, colorHexes),
      projectSettingsJson: bambuProjectSettings(colorHexes),
      sliceInfoXml:       bambuSliceInfo(cleanedPlates, colorHexes),
    };
  }

  function buildFullProject3MF() {
    if (!state.grid || !state.palette.length)
      throw new Error('Generate the project before saving the full 3MF.');

    const baseMesh    = buildDotMesh();
    const diameterMm  = mm(clamp(Number(controls.dotDiameterCm.value), 1, 10));
    const pitch       = diameterMm + Math.max(1.5, Math.min(4, diameterMm * 0.08));
    const bed         = 250; // mm  (25 cm)
    const margin      = Math.max(4, Math.min(10, diameterMm * 0.18));
    const usable      = bed - margin * 2;
    const perRow      = Math.max(1, Math.floor((usable + 0.001) / pitch));
    const perPlate    = Math.max(1, perRow * perRow);

    const plates = [];
    for (let colorIndex = 0; colorIndex < state.palette.length; colorIndex++) {
      const count = state.counts[colorIndex] || 0;
      if (!count) continue;
      let remaining = count, chunk = 0;
      while (remaining > 0) {
        plates.push({ colorIndex, count: Math.min(perPlate, remaining), colorPlateIndex: ++chunk });
        remaining -= perPlate;
      }
    }

    const objects = [];
    let plateNumber = 1;
    for (const plate of plates) {
      const meshes = [];
      for (let i = 0; i < plate.count; i++) {
        const gx = i % perRow;
        const gy = Math.floor(i / perRow);
        const x = margin + diameterMm / 2 + gx * pitch;
        const y = margin + diameterMm / 2 + gy * pitch;
        meshes.push(translatedMesh(baseMesh, x, y, 0));
      }
      objects.push({
        name:        `plate_${plateNumber}_color_${plate.colorIndex+1}_batch_${plate.colorPlateIndex}`,
        plateName:   `Plate ${plateNumber} — Color ${plate.colorIndex+1} Batch ${plate.colorPlateIndex}`,
        plateIndex:  plateNumber,
        colorIndex:  plate.colorIndex,
        mesh:        mergeMeshes(meshes),
      });
      plateNumber++;
    }

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/plain"/>
  <Default Extension="json" ContentType="application/json"/>
</Types>`;
    const pkgRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
    const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/Metadata/model_settings.config" Id="rel_model_settings" Type="http://schemas.bambulab.com/package/2021/model_settings"/>
  <Relationship Target="/Metadata/project_settings.config" Id="rel_project_settings" Type="http://schemas.bambulab.com/package/2021/project_settings"/>
  <Relationship Target="/Metadata/slice_info.config" Id="rel_slice_info" Type="http://schemas.bambulab.com/package/2021/slice_info"/>
</Relationships>`;

    const modelPackage = meshTo3mfModelColored(objects, state.palette.map(rgbToHex));
    const blob = zipStore([
      { name: '[Content_Types].xml',              data: contentTypes },
      { name: '_rels/.rels',                      data: pkgRels },
      { name: '3D/_rels/3dmodel.model.rels',      data: modelRels },
      { name: '3D/3dmodel.model',                 data: modelPackage.modelXml },
      { name: 'Metadata/model_settings.config',   data: modelPackage.modelSettingsXml },
      { name: 'Metadata/project_settings.config', data: modelPackage.projectSettingsJson },
      { name: 'Metadata/slice_info.config',       data: modelPackage.sliceInfoXml },
    ]);
    return { blob, meta: { perPlate, totalPlates: plates.length, pitch, bed } };
  }

  // ─────────────────────────────────────────────
  // M2. Baseframe 3MF (modular physical base)
  // ─────────────────────────────────────────────

  function getBaseframeConfig() {
    // Dot diameter — controls cavity size
    const diameterMm  = mm(clamp(Number(controls.dotDiameterCm.value), 1, 10));

    // Step = center-to-center distance — same formula as buildFullProject3MF
    // This guarantees identical spacing in the base and in the print layout
    const stepMm      = diameterMm + Math.max(1.5, Math.min(4, diameterMm * 0.08));

    // Cavity radii based on diameter (not step) so the socket fits the dot
    const seatInset   = clamp(diameterMm * 0.0045, 0.08, 0.16);
    const socketWall  = clamp(diameterMm * 0.055, 1.0, 1.6);
    const socketOpenR = (diameterMm - seatInset * 2) / 2;  // inner radius = dot clearance
    const socketOutR  = Math.min(socketOpenR + socketWall, stepMm / 2 - 0.4); // outer bounded by step

    const totalThick  = 4.0;
    const floorThick  = 2.0;
    const wallH       = totalThick - floorThick;
    const outerFrame  = Math.max(3.2, seatInset + 2.6);
    const connRail    = clamp(socketWall + 0.45, 1.8, 2.5);
    const connDepth   = 6.0;
    const slotSpan    = clamp(stepMm * 1.8, 18, 30);
    const bodyMaxSide = 200 - connDepth - outerFrame * 2;
    const colsPerPlate = Math.max(1, Math.floor(bodyMaxSide / stepMm));
    const rowsPerPlate = Math.max(1, Math.floor(bodyMaxSide / stepMm));

    return {
      diameterMm, stepMm, totalThick, floorThick, wallH, outerFrame,
      connRail, connDepth, slotSpan,
      colsPerPlate, rowsPerPlate,
      socketOpenR, socketOutR,
      shape: controls.shapeFamily.value,
    };
  }

  function buildBaseframePlateLayout(cfg) {
    const plates = [];
    let rowBlock = 0;
    for (let yStart = 0; yStart < state.rows; yStart += cfg.rowsPerPlate) {
      const rows = Math.min(cfg.rowsPerPlate, state.rows - yStart);
      let colBlock = 0;
      for (let xStart = 0; xStart < state.cols; xStart += cfg.colsPerPlate) {
        const cols      = Math.min(cfg.colsPerPlate, state.cols - xStart);
        const hasLeft   = xStart > 0;
        const hasRight  = xStart + cols < state.cols;
        const hasBottom = yStart > 0;
        const hasTop    = yStart + rows < state.rows;
        const lFrame    = hasLeft   ? 0 : cfg.outerFrame;
        const rFrame    = hasRight  ? 0 : cfg.outerFrame;
        const bFrame    = hasBottom ? 0 : cfg.outerFrame;
        const tFrame    = hasTop    ? 0 : cfg.outerFrame;
        const bodyW     = cols * cfg.stepMm + lFrame + rFrame;
        const bodyH     = rows * cfg.stepMm + bFrame + tFrame;
        const code      = `${String.fromCharCode(65 + rowBlock)}${colBlock + 1}`;
        plates.push({
          code, cols, rows, bodyW, bodyH,
          hasLeft, hasRight, hasBottom, hasTop,
          lFrame, rFrame, bFrame, tFrame,
          cellOriginX: lFrame, cellOriginY: bFrame,
        });
        colBlock++;
      }
      rowBlock++;
    }
    return plates;
  }

  function buildBaseframePlateMesh(plate, cfg) {
    const parts   = [];
    const fZ      = cfg.floorThick;
    const wH      = cfg.wallH;
    const totT    = cfg.totalThick;
    const usableW = plate.cols * cfg.stepMm;
    const usableH = plate.rows * cfg.stepMm;

    // Connector slot span centered on each side
    const slotSpanY = Math.min(cfg.slotSpan, Math.max(6, usableH - 2));
    const slotSpanX = Math.min(cfg.slotSpan, Math.max(6, usableW - 2));
    const slotY0    = plate.cellOriginY + (usableH - slotSpanY) / 2;
    const slotY1    = slotY0 + slotSpanY;
    const slotX0    = plate.cellOriginX + (usableW - slotSpanX) / 2;
    const slotX1    = slotX0 + slotSpanX;

    // ── 1. Floor slab — full plate footprint ──
    parts.push(buildBoxMesh(0, 0, 0, plate.bodyW, plate.bodyH, fZ));

    // ── 2. Left side: outer border OR female connector slots ──
    if (plate.hasLeft) {
      // Two solid strips flanking the slot gap
      parts.push(buildBoxMesh(0, 0,     fZ, cfg.connRail, slotY0,              wH));
      parts.push(buildBoxMesh(0, slotY1, fZ, cfg.connRail, plate.bodyH - slotY1, wH));
      // Two finger boxes inside the slot (female receptor pockets)
      parts.push(buildBoxMesh(0, slotY0,              fZ, cfg.connDepth, cfg.connRail, wH));
      parts.push(buildBoxMesh(0, slotY1 - cfg.connRail, fZ, cfg.connDepth, cfg.connRail, wH));
    } else {
      parts.push(buildBoxMesh(0, 0, fZ, plate.lFrame, plate.bodyH, wH));
    }

    // ── 3. Right side: outer border OR male connector tab ──
    if (plate.hasRight) {
      // Tab protrudes beyond the plate body (mates with left female slot)
      parts.push(buildBoxMesh(plate.bodyW, slotY0, fZ, cfg.connDepth, slotSpanY, wH));
    } else {
      parts.push(buildBoxMesh(plate.bodyW - plate.rFrame, 0, fZ, plate.rFrame, plate.bodyH, wH));
    }

    // ── 4. Bottom side: outer border OR female connector slots ──
    if (plate.hasBottom) {
      parts.push(buildBoxMesh(0,      0, fZ, slotX0,              cfg.connRail, wH));
      parts.push(buildBoxMesh(slotX1, 0, fZ, plate.bodyW - slotX1, cfg.connRail, wH));
      parts.push(buildBoxMesh(slotX0,              0, fZ, cfg.connRail, cfg.connDepth, wH));
      parts.push(buildBoxMesh(slotX1 - cfg.connRail, 0, fZ, cfg.connRail, cfg.connDepth, wH));
    } else {
      parts.push(buildBoxMesh(0, 0, fZ, plate.bodyW, plate.bFrame, wH));
    }

    // ── 5. Top side: outer border OR male connector tab ──
    if (plate.hasTop) {
      parts.push(buildBoxMesh(slotX0, plate.bodyH, fZ, slotSpanX, cfg.connDepth, wH));
    } else {
      parts.push(buildBoxMesh(0, plate.bodyH - plate.tFrame, fZ, plate.bodyW, plate.tFrame, wH));
    }

    // ── 6. Socket ring per cell (floorZ → totalThick) ──
    const innerPoly = makePolygon2D(cfg.shape, cfg.socketOpenR);
    const outerPoly = makePolygon2D(cfg.shape, cfg.socketOutR);
    for (let row = 0; row < plate.rows; row++) {
      for (let col = 0; col < plate.cols; col++) {
        const cx = plate.cellOriginX + (col + 0.5) * cfg.stepMm;
        const cy = plate.cellOriginY + (row + 0.5) * cfg.stepMm;
        const inner = innerPoly.map(([x, y]) => [x + cx, y + cy]);
        const outer = outerPoly.map(([x, y]) => [x + cx, y + cy]);
        parts.push(buildRingPrism(outer, inner, fZ, totT));
      }
    }

    return mergeMeshes(parts);
  }

  function buildBaseframe3MF() {
    if (!state.grid || !state.palette.length)
      throw new Error('Generate the project first.');

    const cfg    = getBaseframeConfig();
    const plates = buildBaseframePlateLayout(cfg);

    const objects = [];
    plates.forEach((plate, idx) => {
      const mesh  = buildBaseframePlateMesh(plate, cfg);
      const wcm   = round(plate.bodyW / 10, 1);
      const hcm   = round(plate.bodyH / 10, 1);
      objects.push({
        name:       `BaseFrame_${plate.code}`,
        plateName:  `BaseFrame_${plate.code} (${wcm}×${hcm} cm)`,
        plateIndex: idx + 1,
        colorIndex: 0,
        mesh:       translatedMesh(mesh, 5, 5, 0),
      });
    });

    const baseHex = '#808080';
    const pkg     = meshTo3mfModelColored(objects, [baseHex]);

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/plain"/>
  <Default Extension="json" ContentType="application/json"/>
</Types>`;
    const pkgRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
    const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/Metadata/model_settings.config" Id="rel_model_settings" Type="http://schemas.bambulab.com/package/2021/model_settings"/>
  <Relationship Target="/Metadata/project_settings.config" Id="rel_project_settings" Type="http://schemas.bambulab.com/package/2021/project_settings"/>
  <Relationship Target="/Metadata/slice_info.config" Id="rel_slice_info" Type="http://schemas.bambulab.com/package/2021/slice_info"/>
</Relationships>`;

    return zipStore([
      { name: '[Content_Types].xml',              data: contentTypes },
      { name: '_rels/.rels',                      data: pkgRels },
      { name: '3D/_rels/3dmodel.model.rels',      data: modelRels },
      { name: '3D/3dmodel.model',                 data: pkg.modelXml },
      { name: 'Metadata/model_settings.config',   data: pkg.modelSettingsXml },
      { name: 'Metadata/project_settings.config', data: pkg.projectSettingsJson },
      { name: 'Metadata/slice_info.config',       data: pkg.sliceInfoXml },
    ]);
  }

  // ─────────────────────────────────────────────
  // N. Production manual (HTML)
  // ─────────────────────────────────────────────
  function buildProductionHTML() {
    const dotDiameter = Number(controls.dotDiameterCm.value);
    const dotHeight   = Number(controls.dotHeightCm.value);
    const shape = labelShape(controls.shapeFamily.value);
    const top   = labelTop(controls.topStyle.value);
    const totalDots = state.cols * state.rows;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width  = Math.max(1600, state.cols * 36 + 80);
    exportCanvas.height = Math.max(1200, state.rows * 36 + 80);
    drawDotMapOnCanvas(exportCanvas, { forExport: true });
    const mapDataUrl = exportCanvas.toDataURL('image/png');

    const steps = [
      'Export the unit dot STL or 3MF and print it with your chosen filament colors.',
      'Separate printed dots by color as shown in the legend.',
      'Print the total quantity of each color listed in the summary table.',
      'Assemble the frame row by row, left to right, following the numbered map.',
      'Check each completed row before moving to the next.',
      'Use a physical base grid matching the dot diameter to aid alignment.',
    ];

    const rowsHtml = state.palette.map((c, i) => `
      <tr>
        <td>${i+1}</td>
        <td style="background:${rgbToHex(c)}"></td>
        <td>${rgbToHex(c)}</td>
        <td>${state.counts[i] || 0}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DotArt — Production Manual</title>
<style>
  body { font-family: -apple-system, Inter, Arial, sans-serif; color: #1d1d1f; padding: 28px; line-height: 1.55; }
  h1 { font-size: 24px; margin-bottom: 6px; }
  h2 { font-size: 18px; margin: 0 0 10px; }
  .meta { background: #f5f5f7; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; font-size: 14px; line-height: 1.7; }
  .grid { display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 20px; margin-bottom: 18px; }
  .card { border: 1px solid rgba(0,0,0,.1); border-radius: 14px; padding: 16px; }
  .map-card img { width: 100%; border-radius: 10px; image-rendering: pixelated; }
  ul { margin: 8px 0 0 18px; }
  li { margin-bottom: 6px; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { padding: 9px 12px; border: 1px solid rgba(0,0,0,.1); text-align: left; }
  th { background: #f5f5f7; font-weight: 600; }
</style>
</head>
<body>
<h1>DotArt — Production &amp; Assembly Manual</h1>
<div class="meta">
  <strong>Frame:</strong> ${round(state.frameWidthCm, 1)} × ${round(state.frameHeightCm, 1)} cm &nbsp;|&nbsp;
  <strong>Grid:</strong> ${state.cols} × ${state.rows} (${totalDots} dots) &nbsp;|&nbsp;
  <strong>Unit dot:</strong> ${shape}, ${top} top, ⌀${round(dotDiameter, 1)} cm × ${round(dotHeight, 1)} cm &nbsp;|&nbsp;
  <strong>Colors:</strong> ${state.palette.length}
</div>
<div class="grid">
  <div class="card map-card">
    <h2>Assembly map</h2>
    <img src="${mapDataUrl}" alt="Dot art map">
  </div>
  <div class="card">
    <h2>Assembly guide</h2>
    <ul>${steps.map(s => `<li>${s}</li>`).join('')}</ul>
  </div>
</div>
<div class="card">
  <h2>Print summary by color</h2>
  <table>
    <thead><tr><th>#</th><th>Sample</th><th>Hex color</th><th>Dot count</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────
  // O. Stats & palette UI
  // ─────────────────────────────────────────────
  function updateStats() {
    if (!state.grid) { statsEl.innerHTML = ''; return; }
    const dotDia    = Number(controls.dotDiameterCm.value);
    const dotHeight = Number(controls.dotHeightCm.value);
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-label">${t('stat.grid')}</div><div class="stat-value">${state.cols} \u00d7 ${state.rows}</div></div>
      <div class="stat-card"><div class="stat-label">${t('stat.totalDots')}</div><div class="stat-value">${state.cols * state.rows}</div></div>
      <div class="stat-card"><div class="stat-label">${t('stat.frameSize')}</div><div class="stat-value">${round(state.frameWidthCm,1)} \u00d7 ${round(state.frameHeightCm,1)} cm</div></div>
      <div class="stat-card"><div class="stat-label">${t('stat.unitDot')}</div><div class="stat-value">\u00d8${round(dotDia,1)} \u00d7 ${round(dotHeight,1)} cm</div></div>
    `;
  }

  function recomputeCounts() {
    state.counts = new Array(state.palette.length).fill(0);
    state.grid.forEach(idx => state.counts[idx]++);
  }

  function updatePalette() {
    if (!state.palette.length) { paletteList.innerHTML = ''; return; }
    paletteList.innerHTML = state.palette.map((color, i) => {
      const hex = rgbToHex(color);
      const numColor = luminance(color) > 160 ? '#111827' : '#ffffff';
      return `
        <div class="swatch">
          <div class="swatch-box" style="background:${hex}" title="Click to change color">
            <span class="swatch-num" style="color:${numColor}">${i + 1}</span>
            <input type="color" class="swatch-color-input" data-index="${i}" value="${hex}">
          </div>
          <div>
            <div class="swatch-name">${t('palette.color')} ${i + 1}</div>
            <div class="swatch-hex">${hex}</div>
          </div>
          <div class="swatch-count">
            <strong>${state.counts[i] || 0}</strong>
            <span>${t('palette.dots')}</span>
          </div>
        </div>`;
    }).join('');

    paletteList.querySelectorAll('.swatch-color-input').forEach(input => {
      input.addEventListener('input', e => {
        const idx = Number(e.target.dataset.index);
        const hex = e.target.value;
        state.palette[idx] = [
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
        ];
        const swatch = e.target.closest('.swatch');
        swatch.querySelector('.swatch-box').style.background = hex;
        swatch.querySelector('.swatch-hex').textContent = hex;
        swatch.querySelector('.swatch-num').style.color =
          luminance(state.palette[idx]) > 160 ? '#111827' : '#ffffff';
        renderDotMap();
      });
    });
  }

  // ─────────────────────────────────────────────
  // O2. Dot color picker (click on map to reassign)
  // ─────────────────────────────────────────────
  let _dcpOutsideHandler = null;

  function closeDotColorPicker() {
    const p = document.getElementById('dot-color-picker');
    if (p) p.remove();
    if (_dcpOutsideHandler) {
      document.removeEventListener('click', _dcpOutsideHandler);
      _dcpOutsideHandler = null;
    }
  }

  function showDotColorPicker(clientX, clientY, gridIndex, currentColorIdx) {
    closeDotColorPicker();

    const picker = document.createElement('div');
    picker.id = 'dot-color-picker';
    picker.innerHTML = `
      <div class="dcp-title">Trocar cor do ponto</div>
      <div class="dcp-colors">
        ${state.palette.map((color, i) => {
          const hex = rgbToHex(color);
          const numColor = luminance(color) > 160 ? '#111827' : '#ffffff';
          const active = i === currentColorIdx ? ' dcp-color--active' : '';
          return `<button class="dcp-color${active}" data-idx="${i}"
                    style="background:${hex}" title="${t('palette.color')} ${i + 1}">
                    <span style="color:${numColor}">${i + 1}</span>
                  </button>`;
        }).join('')}
      </div>`;

    document.body.appendChild(picker);

    // Position near click, keep within viewport
    const pw = picker.offsetWidth  || 220;
    const ph = picker.offsetHeight || 100;
    let left = clientX + 14;
    let top  = clientY - 20;
    if (left + pw > window.innerWidth  - 8) left = clientX - pw - 14;
    if (top  + ph > window.innerHeight - 8) top  = window.innerHeight - ph - 8;
    if (top < 8) top = 8;
    picker.style.left = left + 'px';
    picker.style.top  = top  + 'px';

    picker.querySelectorAll('.dcp-color').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const newIdx = Number(btn.dataset.idx);
        state.grid[gridIndex] = newIdx;
        recomputeCounts();
        renderDotMap();
        updatePalette();
        closeDotColorPicker();
      });
    });

    // Fechar ao clicar fora — registra e rastreia o handler para poder removê-lo
    setTimeout(() => {
      _dcpOutsideHandler = () => closeDotColorPicker();
      document.addEventListener('click', _dcpOutsideHandler, { once: true });
    }, 0);
  }

  dotCanvas.addEventListener('click', e => {
    if (!state.grid) return;
    // Impede que o clique no canvas dispare o handler de "fora" do picker
    e.stopPropagation();

    const rect   = dotCanvas.getBoundingClientRect();
    const scaleX = dotCanvas.width  / rect.width;
    const scaleY = dotCanvas.height / rect.height;
    const cx     = (e.clientX - rect.left) * scaleX;
    const cy     = (e.clientY - rect.top)  * scaleY;

    const margin = 18;
    const cell   = Math.min(
      (dotCanvas.width  - margin * 2) / state.cols,
      (dotCanvas.height - margin * 2) / state.rows
    );
    const ox = (dotCanvas.width  - cell * state.cols)  / 2;
    const oy = (dotCanvas.height - cell * state.rows) / 2;

    const col = Math.floor((cx - ox) / cell);
    const row = Math.floor((cy - oy) / cell);

    if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return;

    const gridIndex     = row * state.cols + col;
    const currentColor  = state.grid[gridIndex];
    showDotColorPicker(e.clientX, e.clientY, gridIndex, currentColor);
  });

  // ─────────────────────────────────────────────
  // P. Download helper
  // ─────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─────────────────────────────────────────────
  // Q. Canvas sizing
  // ─────────────────────────────────────────────
  function initCanvasSizes() {
    const vw = window.innerWidth;
    let srcW, srcH, dotW, dotH, prevW, prevH;

    if (vw <= 600) {
      // Mobile: fit within the screen, leave room for padding
      srcW  = Math.max(280, vw - 48); srcH  = Math.round(srcW  * 0.75);
      dotW  = Math.max(280, vw - 48); dotH  = Math.round(dotW  * 0.77);
      prevW = Math.max(280, vw - 48); prevH = Math.round(prevW * 0.68);
    } else if (vw <= 1100) {
      // Tablet / stacked layout
      srcW  = 580;  srcH  = 440;
      dotW  = 1000; dotH  = 780;
      prevW = 580;  prevH = 380;
    } else {
      // Desktop: preview lives in 360px left column; dot map spans full right column
      srcW  = 480;  srcH  = 360;
      dotW  = 1100; dotH  = 820;
      prevW = 320;  prevH = 280;
    }

    sourceCanvas.width      = srcW;  sourceCanvas.height      = srcH;
    dotCanvas.width         = dotW;  dotCanvas.height         = dotH;
    dotPreviewCanvas.width  = prevW; dotPreviewCanvas.height  = prevH;
  }

  function drawPlaceholder() {
    [sourceCanvas, dotCanvas].forEach(canvas => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isDark() ? '#2c2c2e' : '#f0f4ff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isDark() ? '#636366' : '#86868b';
      ctx.font = '15px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('placeholder'), canvas.width / 2, canvas.height / 2);
    });
    renderDotPreview();
  }

  // ─────────────────────────────────────────────
  // R. Generate
  // ─────────────────────────────────────────────
  async function generate() {
    if (!state.image) { setStatus(t('status.upload')); return; }

    const dotDiameterCm = clamp(Number(controls.dotDiameterCm.value) || 2, 1, 10);
    const dotHeightCm   = clamp(Number(controls.dotHeightCm.value)   || 2, 1, 10);
    const colorCount    = clamp(Math.round(Number(controls.colorCount.value) || 6), 2, 20);
    const frameWidthCm  = Math.max(10, Number(controls.frameWidthCm.value) || 40);

    const cols = Math.max(1, Math.floor(frameWidthCm / dotDiameterCm));
    if (cols > 220) {
      setStatus(t('status.gridTooLarge'));
      return;
    }

    setStatus(t('status.processing'));
    generateBtn.disabled = true;

    // Yield to browser so the status message renders
    await new Promise(r => setTimeout(r, 0));

    const sampled = sampleGrid(state.image, cols, state.crop);
    // Filter out transparent pixels for quantization only
    const opaquePixels = sampled.pixels.filter(p => p !== null);
    if (opaquePixels.length === 0) { setStatus(t('status.transparent')); generateBtn.disabled = false; return; }
    const q = kmeansQuantize(opaquePixels, colorCount);

    // Build full grid assignments (transparent cells → nearest opaque neighbor, or color 0)
    const allAssignments = [];
    let opaqueIdx = 0;
    for (const p of sampled.pixels) {
      if (p !== null) { allAssignments.push(q.assignments[opaqueIdx++]); }
      else { allAssignments.push(0); }
    }

    state.palette       = q.palette;
    state.grid          = allAssignments;
    state.cols          = sampled.cols;
    state.rows          = sampled.rows;
    state.counts        = new Array(q.palette.length).fill(0);
    q.assignments.forEach(i => state.counts[i]++);
    state.frameWidthCm  = sampled.cols * dotDiameterCm;
    state.frameHeightCm = sampled.rows * dotDiameterCm;

    renderOriginal();
    renderDotMap();
    renderDotPreview();
    updatePalette();
    updateStats();

    dotCanvas.classList.add('editable');

    setStatus(tFmt('status.done', { cols: state.cols, rows: state.rows, colors: state.palette.length }));

    [downloadMapBtn, exportStlBtn, export3mfBtn, saveProjectBtn, exportBaseframeBtn].forEach(b => b.disabled = false);
    generateBtn.disabled = false;
  }

  // ─────────────────────────────────────────────
  // S. Dark mode toggle
  // ─────────────────────────────────────────────
  const html = document.documentElement;

  function isDark() { return html.getAttribute('data-theme') === 'dark'; }

  function applyTheme(dark) {
    if (dark) html.setAttribute('data-theme', 'dark');
    else html.removeAttribute('data-theme');
    // Re-render canvases with correct theme colors
    if (state.grid) { renderOriginal(); renderDotMap(); }
    else drawPlaceholder();
    renderDotPreview();
  }

  // ─────────────────────────────────────────────
  // S2. Language selection
  // ─────────────────────────────────────────────
  const LANG_LABELS = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };

  function applyLanguage(lang) {
    currentLang = LANG[lang] ? lang : 'en';
    localStorage.setItem('dotart-lang', currentLang);

    // Update button label
    el('langLabel').textContent = LANG_LABELS[currentLang] || currentLang.toUpperCase().slice(0, 2);

    // Mark active option
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === currentLang);
    });

    // Update all static text elements
    document.querySelectorAll('[data-i18n]').forEach(node => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });

    // Update shape select options
    Array.from(controls.shapeFamily.options).forEach(opt => { opt.text = t('shape.' + opt.value); });
    // Update top style select options
    Array.from(controls.topStyle.options).forEach(opt => { opt.text = t('top.' + opt.value); });

    // Refresh dynamic UI
    updateSliderDisplays();
    checkGeometry();
    if (state.grid) {
      updateStats();
      updatePalette();
    } else {
      setStatus(t('status.upload'));
    }

    // Re-render canvases (their text is language-aware)
    if (state.grid) { renderOriginal(); renderDotMap(); }
    else drawPlaceholder();
    renderDotPreview();
  }

  // Load saved preference (or respect OS preference on first visit)
  const savedTheme = localStorage.getItem('dotart-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) applyTheme(true);

  el('themeToggle').addEventListener('click', () => {
    const dark = !isDark();
    localStorage.setItem('dotart-theme', dark ? 'dark' : 'light');
    applyTheme(dark);
  });

  // ─────────────────────────────────────────────
  // T. Event listeners
  // ─────────────────────────────────────────────
  function resetCropView() {
    state.crop = null;
    state.view = { zoom: 1, panX: 0, panY: 0 };
    renderOriginal();
  }

  el('resetCropBtn').addEventListener('click', resetCropView);

  imageInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const img = await readImage(file);
      state.image         = img;
      state.originalWidth  = img.width;
      state.originalHeight = img.height;
      resetCropView();
      setStatus(t('status.imageLoaded'));
    } catch {
      setStatus(t('status.imageError'));
    }
  });

  // Update slider value badges and track fill on every input
  function updateSliderDisplays() {
    const d = controls.dotDiameterCm, h = controls.dotHeightCm;
    const c = controls.colorCount,   f = controls.frameWidthCm;

    el('dotDiameterVal').textContent = `${round(Number(d.value), 1)} cm`;
    el('dotHeightVal').textContent   = `${round(Number(h.value), 1)} cm`;
    el('colorCountVal').textContent  = `${c.value} ${Number(c.value) === 1 ? t('slider.color') : t('slider.colors')}`;
    el('frameWidthVal').textContent  = `${f.value} cm`;

    // Update CSS custom property for the blue fill on WebKit
    const pct = slider => {
      const min = Number(slider.min), max = Number(slider.max), val = Number(slider.value);
      return `${((val - min) / (max - min)) * 100}%`;
    };
    d.style.setProperty('--pct', pct(d));
    h.style.setProperty('--pct', pct(h));
    c.style.setProperty('--pct', pct(c));
    f.style.setProperty('--pct', pct(f));
  }

  Object.values(controls).forEach(ctrl => ctrl.addEventListener('input', () => {
    updateSliderDisplays();
    renderDotPreview();
    checkGeometry();
  }));

  generateBtn.addEventListener('click', generate);

  exportStlBtn.addEventListener('click', () => {
    const mesh = buildDotMesh();
    const stl  = meshToSTL(`dot_${controls.shapeFamily.value}_${controls.topStyle.value}`, mesh);
    downloadBlob(new Blob([stl], { type: 'model/stl' }),
      `dot_${controls.shapeFamily.value}_${controls.topStyle.value}.stl`);
  });

  export3mfBtn.addEventListener('click', () => {
    const mesh = buildDotMesh();
    const blob = export3MF(mesh);
    downloadBlob(blob, `dot_${controls.shapeFamily.value}_${controls.topStyle.value}.3mf`);
  });

  saveProjectBtn.addEventListener('click', () => {
    try {
      const result = buildFullProject3MF();
      downloadBlob(result.blob, 'dotart_full_project.3mf');
      setStatus(tFmt('status.projectSaved', { plates: result.meta.totalPlates, bed: result.meta.bed / 10, perPlate: result.meta.perPlate }));
    } catch (err) {
      setStatus(err.message || t('status.projectError'));
    }
  });

  downloadMapBtn.addEventListener('click', () => {
    const html = buildProductionHTML();
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'dotart_manual.html');
  });

  exportBaseframeBtn.addEventListener('click', () => {
    try {
      exportBaseframeBtn.disabled = true;
      exportBaseframeBtn.textContent = 'Generating…';
      // Yield to browser so button updates before heavy computation
      setTimeout(() => {
        try {
          const blob = buildBaseframe3MF();
          const dotDia = round(Number(controls.dotDiameterCm.value), 1);
          downloadBlob(blob, `dotart_baseframe_${controls.shapeFamily.value}_${dotDia}cm.3mf`);
        } catch (err) {
          setStatus('Baseframe error: ' + (err.message || err));
        } finally {
          exportBaseframeBtn.disabled = false;
          exportBaseframeBtn.textContent = 'Download Full Baseframe (.3mf)';
        }
      }, 20);
    } catch (err) {
      setStatus('Baseframe error: ' + (err.message || err));
    }
  });

  // Language picker
  const langBtn      = el('langBtn');
  const langDropdown = el('langDropdown');
  const langPicker   = el('langPicker');

  langBtn.addEventListener('click', e => {
    langDropdown.classList.toggle('open');
    e.stopPropagation();
  });

  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
      langDropdown.classList.remove('open');
    });
  });

  document.addEventListener('click', e => {
    if (!langPicker.contains(e.target)) langDropdown.classList.remove('open');
  });

  // ─────────────────────────────────────────────
  // T. Resize handler
  // ─────────────────────────────────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initCanvasSizes();
      if (state.grid) {
        renderOriginal();
        renderDotMap();
      } else {
        drawPlaceholder();
      }
      renderDotPreview();
    }, 200);
  });

  // ─────────────────────────────────────────────
  // U. Init
  // ─────────────────────────────────────────────
  // Prevent page scroll while rotating the 3D preview on touch
  dotPreviewCanvas.style.touchAction = 'none';

  initCanvasSizes();
  updateSliderDisplays();
  checkGeometry();

  // Init language (loads from localStorage, falls back to 'en')
  const savedLang = localStorage.getItem('dotart-lang') || 'en';
  applyLanguage(savedLang);

});
