
import * as THREE from 'three';

export const TREE_HEIGHT = 12;
export const TREE_RADIUS = 4.5;

export const PALETTE = {
  emerald: new THREE.Color('#0bf4aa'),
  gold: new THREE.Color('#fbe774'),
  red: new THREE.Color('#e51010'),
  silver: new THREE.Color('#cccccc'),
  goldLight: new THREE.Color('#fff4b0'),
  white: new THREE.Color('#ffffff'),
  blueStart: new THREE.Color('#00C6FF'), // Cyan/Tech Blue
  blueEnd: new THREE.Color('#0072FF'),   // Deep Royal Blue
  brown: new THREE.Color('#8b4513'),
  darkBrown: new THREE.Color('#5d4037'),
  skin: new THREE.Color('#ffccaa'),
  black: new THREE.Color('#1a1a1a'),
};

// --- Helpers ---

export const getRandomSpherePoint = (radius: number): THREE.Vector3 => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius; 
  const sinPhi = Math.sin(phi);
  const x = r * sinPhi * Math.cos(theta);
  const y = r * sinPhi * Math.sin(theta);
  const z = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

// Get point inside a directed cylinder with random volume distribution
const getCylinderPoint = (h: number, r: number, yBase: number = 0): THREE.Vector3 => {
  const theta = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * r;
  const y = Math.random() * h;
  return new THREE.Vector3(rad * Math.cos(theta), y + yBase, rad * Math.sin(theta));
};

const getBoxPoint = (w: number, h: number, d: number, center: THREE.Vector3): THREE.Vector3 => {
  return new THREE.Vector3(
    center.x + (Math.random() - 0.5) * w,
    center.y + (Math.random() - 0.5) * h,
    center.z + (Math.random() - 0.5) * d
  );
};

const getBezierTubePoint = (
    p0: THREE.Vector3, 
    p1: THREE.Vector3, 
    p2: THREE.Vector3, 
    p3: THREE.Vector3, 
    radiusStart: number,
    radiusEnd: number
): THREE.Vector3 => {
    const t = Math.random();
    const oneMinusT = 1 - t;
    const a = p0.clone().multiplyScalar(oneMinusT * oneMinusT * oneMinusT);
    const b = p1.clone().multiplyScalar(3 * oneMinusT * oneMinusT * t);
    const c = p2.clone().multiplyScalar(3 * oneMinusT * t * t);
    const d = p3.clone().multiplyScalar(t * t * t);
    const center = a.add(b).add(c).add(d);
    const r = radiusStart * (1 - t) + radiusEnd * t;
    return center.add(getRandomSpherePoint(r));
}

interface Region {
  weight: number;
  generator: () => THREE.Vector3;
  color: THREE.Color;
}

const sampleRegions = (regions: Region[]): { pos: THREE.Vector3, color: THREE.Color } => {
  const totalWeight = regions.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const region of regions) {
    if (random < region.weight) {
      return { pos: region.generator(), color: region.color };
    }
    random -= region.weight;
  }
  return { pos: new THREE.Vector3(), color: PALETTE.white };
};

interface ShapeData {
  pos: THREE.Vector3;
  color: THREE.Color;
}

const TEXT_POINT_CACHE: Record<string, THREE.Vector3[]> = {};
const IMAGE_POINT_CACHE: Record<string, THREE.Vector3[]> = {};

export const getCanvasImagePoints = async (imageUrl: string, density: number = 2.5): Promise<THREE.Vector3[]> => {
  if (IMAGE_POINT_CACHE[imageUrl]) return IMAGE_POINT_CACHE[imageUrl];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve([]);

      // Scale image to a reasonable sampling size
      const maxDim = 300;
      let w = img.width;
      let h = img.height;
      
      // 检查是否是极小图片（占位符）
      if (w < 5 || h < 5) {
          resolve([]);
          return;
      }

      if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w *= ratio;
          h *= ratio;
      }
      
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const points: THREE.Vector3[] = [];
      const step = Math.max(1, Math.floor(4 / density));

      const centerX = w / 2;
      const centerY = h / 2;

      for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
              const index = (y * w + x) * 4;
              const r = data[index];
              const g = data[index + 1];
              const b = data[index + 2];
              const a = data[index + 3];
              
              // 改进探测逻辑：
              // 1. 如果有透明度，检查 alpha (支持透明 PNG Logo)
              // 2. 如果不透明，检查亮度（支持高对比度 Logo，如黑底白字或白底黑字）
              const brightness = (r + g + b) / 3;
              const isMeaningfulPixel = (a > 50) && (brightness < 210 || a > 200);
              
              if (isMeaningfulPixel) {
                  const wx = (x - centerX) * 0.05;
                  const wy = -(y - centerY) * 0.05;
                  points.push(new THREE.Vector3(wx, wy, 0));
              }
          }
      }

      // 如果采样点太少，认为是无效采样，防止圆球 bug
      if (points.length < 10) {
          IMAGE_POINT_CACHE[imageUrl] = [];
          resolve([]);
      } else {
          IMAGE_POINT_CACHE[imageUrl] = points;
          resolve(points);
      }
    };
    img.onerror = () => {
      console.warn("Failed to load image for sampling:", imageUrl);
      resolve([]);
    };
  });
};

const getCanvasTextPoints = (text: string, font: string, density: number = 2): THREE.Vector3[] => {
  const cacheKey = `${text}-${font}`;
  if (TEXT_POINT_CACHE[cacheKey]) {
      return TEXT_POINT_CACHE[cacheKey];
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const fontSize = 100;
  const lineHeight = fontSize * 1.2;
  ctx.font = font.replace('{size}', `${fontSize}px`);
  
  const lines = text.split('\n');
  let maxWidth = 0;
  lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
  });

  const totalHeight = lines.length * lineHeight;
  
  canvas.width = maxWidth + 40;
  canvas.height = totalHeight + 40;

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font.replace('{size}', `${fontSize}px`);

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
      ctx.fillText(line, centerX, startY + i * lineHeight);
  });

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const points: THREE.Vector3[] = [];
  const step = Math.max(1, Math.floor(4 / density)); 

  for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          if (data[index + 3] > 128) {
             const wx = (x - centerX) * 0.04; 
             const wy = -(y - centerY) * 0.04;
             points.push(new THREE.Vector3(wx, wy, 0));
          }
      }
  }

  TEXT_POINT_CACHE[cacheKey] = points;
  return points;
};

export const getVolumetricShapePoint = (
    points: THREE.Vector3[],
    index: number,
    thickness: number = 1.5
): THREE.Vector3 => {
    if (!points || points.length === 0) return new THREE.Vector3();
    const i = index % points.length;
    const pt = points[i].clone();
    pt.z = (Math.random() - 0.5) * thickness;
    pt.x += (Math.random() - 0.5) * 0.1;
    pt.y += (Math.random() - 0.5) * 0.1;
    return pt;
};

const getVolumetricTextPoint = (
    text: string, 
    font: string, 
    index: number, 
    thickness: number = 1.5
): THREE.Vector3 => {
    const points = getCanvasTextPoints(text, font, 2.0);
    return getVolumetricShapePoint(points, index, thickness);
};

const getGradientTextPoint = (
    text: string,
    font: string,
    index: number,
    thickness: number,
    gradStart: THREE.Color,
    gradEnd: THREE.Color,
    widthApprox: number
): ShapeData => {
    const pos = getVolumetricTextPoint(text, font, index, thickness);
    const halfW = widthApprox / 2;
    let t = (pos.x + halfW) / widthApprox;
    t = Math.max(0, Math.min(1, t));
    const color = gradStart.clone().lerp(gradEnd, t);
    return { pos, color };
};

export const getTreePoint = (
  height: number, 
  maxRadius: number, 
  spirals: number = 3,
  spiralTightness: number = 0,
  verticalOffset: number = -2,
  densityBias: number = 1.0 
): THREE.Vector3 => {
  const yNorm = Math.pow(Math.random(), 1 / densityBias);
  const y = yNorm * height;
  const rAtY = maxRadius * (1 - y / height);
  let angle: number;
  let r: number;
  if (spirals > 0) {
    const spiralAngle = (1.0 - yNorm) * (spirals * Math.PI * 2);
    const maxSpread = Math.PI * 2 * (1.0 - spiralTightness);
    angle = spiralAngle + (Math.random() - 0.5) * maxSpread;
    const randomR = Math.sqrt(Math.random()); 
    const rFactor = randomR + (1.0 - randomR) * (spiralTightness * 0.5); 
    r = rAtY * rFactor;
  } else {
    angle = Math.random() * Math.PI * 2;
    r = rAtY * Math.sqrt(Math.random());
  }
  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  return new THREE.Vector3(x, y + verticalOffset, z);
};

export const getHatPoint = (): ShapeData => {
  const p0 = new THREE.Vector3(0, 0, 0);
  const p1 = new THREE.Vector3(0, 2.5, 0);
  const p2 = new THREE.Vector3(0.5, 4.0, -0.5);
  const p3 = new THREE.Vector3(1.5, 5.0, -1.5);
  return sampleRegions([
    { weight: 3.5, color: PALETTE.white, generator: () => {
        const angle = Math.random() * Math.PI * 2;
        const r = 2.2 + (Math.random() - 0.5) * 0.6;
        const y = (Math.random() - 0.5) * 0.7;
        return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }},
    { weight: 8, color: PALETTE.red, generator: () => getBezierTubePoint(p0, p1, p2, p3, 2.0, 0.2) },
    { weight: 1.5, color: PALETTE.white, generator: () => getRandomSpherePoint(0.8).add(p3) }
  ]);
};

export const getStockingPoint = (): ShapeData => {
  return sampleRegions([
    { weight: 4, color: PALETTE.white, generator: () => getCylinderPoint(1.2, 2.1, 3.8) },
    { weight: 7, color: PALETTE.red, generator: () => getCylinderPoint(4.0, 1.7, 0) },
    { weight: 3, color: PALETTE.red, generator: () => getRandomSpherePoint(1.7).add(new THREE.Vector3(0, 0, 0)) },
    { weight: 6, color: PALETTE.red, generator: () => getBezierTubePoint(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, -0.2, 0), new THREE.Vector3(2.5, -0.2, 0), new THREE.Vector3(3.2, 0.2, 0), 1.7, 1.5) },
    { weight: 0.5, color: PALETTE.gold, generator: () => {
        const angle = Math.random() * Math.PI * 2;
        const r = 0.3 + Math.random() * 0.1;
        return new THREE.Vector3(-1.6, 4.8 + Math.sin(angle)*r, Math.cos(angle)*r);
    }}
  ]);
};

export const postProcessStockingColor = (pt: THREE.Vector3, baseColor: THREE.Color): THREE.Color => {
    let t = pt.y;
    if (pt.y < 0.8) t = pt.y - pt.x * 0.6;
    const band = Math.floor(t * 1.1); 
    const pattern = Math.abs(band) % 4;
    if (pattern === 0) return PALETTE.red;
    if (pattern === 1) return PALETTE.white; 
    if (pattern === 2) return PALETTE.emerald;
    return PALETTE.gold;
}

export const postProcessGiftColor = (pt: THREE.Vector3, baseColor: THREE.Color): THREE.Color => baseColor; 

export const getSantaPoint = (): ShapeData => {
  const brightRed = new THREE.Color('#FF0000'); 
  const pureWhite = new THREE.Color('#FFFFFF');
  const skin = new THREE.Color('#FFCBA4');
  const black = new THREE.Color('#000000');
  const gold = new THREE.Color('#FFD700');
  const noseColor = new THREE.Color('#FF7F7F');
  
  return sampleRegions([
      { weight: 6, color: skin, generator: () => getRandomSpherePoint(2.8).add(new THREE.Vector3(0, 4.5, 0.5)) },
      { weight: 0.5, color: black, generator: () => getRandomSpherePoint(0.18).add(new THREE.Vector3(0.65, 5.0, 2.4)) },
      { weight: 0.5, color: black, generator: () => getRandomSpherePoint(0.18).add(new THREE.Vector3(-0.65, 5.0, 2.4)) },
      { weight: 0.3, color: noseColor, generator: () => getRandomSpherePoint(0.35).add(new THREE.Vector3(0, 4.5, 2.9)) },
      { weight: 8, color: pureWhite, generator: () => getRandomSpherePoint(2.2).add(new THREE.Vector3(0, 2.5, 1.8)) },
      { weight: 8, color: pureWhite, generator: () => getBezierTubePoint(new THREE.Vector3(-3.2, 4.0, 1.0), new THREE.Vector3(-1.2, 1.0, 2.5), new THREE.Vector3(1.2, 1.0, 2.5), new THREE.Vector3(3.2, 4.0, 1.0), 1.8, 1.8) },
      { weight: 1.5, color: pureWhite, generator: () => getBezierTubePoint(new THREE.Vector3(-1.4, 4.0, 3.1), new THREE.Vector3(-0.4, 4.1, 3.4), new THREE.Vector3(0.4, 4.1, 3.4), new THREE.Vector3(1.4, 4.0, 3.1), 0.5, 0.5) },
      { weight: 5, color: pureWhite, generator: () => getCylinderPoint(1.2, 4.0, 6.0) },
      
      // Hat Cone: Increased from 7 to 8.05 (+15%)
      { weight: 8.05, color: brightRed, generator: () => getBezierTubePoint(new THREE.Vector3(0, 6.5, 0), new THREE.Vector3(0, 9.5, 0), new THREE.Vector3(2.5, 11.0, -1.0), new THREE.Vector3(4.5, 8.5, -2.5), 3.2, 0.6) },
      
      { weight: 1.5, color: pureWhite, generator: () => getRandomSpherePoint(0.95).add(new THREE.Vector3(4.5, 8.5, -2.5)) },
      
      // Body / Coat: Increased from 10 to 11.5 (+15%)
      { weight: 11.5, color: brightRed, generator: () => {
          const p = getRandomSpherePoint(1.0);
          return new THREE.Vector3(p.x * 4.2, p.y * 3.5 + 0.5, p.z * 4.0);
      }},
      
      { weight: 4, color: black, generator: () => {
          const angle = Math.random() * Math.PI * 2;
          const r = 4.3; const y = (Math.random() - 0.5) * 1.5;
          return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
      }},
      { weight: 1, color: gold, generator: () => getBoxPoint(1.8, 1.8, 0.5, new THREE.Vector3(0, 0, 4.3)) },
      { weight: 3, color: pureWhite, generator: () => getCylinderPoint(0.8, 3.8, -2.5) },
      { weight: 0.5, color: gold, generator: () => getRandomSpherePoint(0.3).add(new THREE.Vector3(0, 1.5, 3.8)) },
      { weight: 0.5, color: gold, generator: () => getRandomSpherePoint(0.3).add(new THREE.Vector3(0, 3.0, 3.2)) },
  ]);
};

export const getGiftPoint = (): ShapeData => {
    const center = new THREE.Vector3(0, 2.5, 0);
    const size = 6.0; 
    const half = size / 2;
    const edgeThick = 0.15;
    const cBody = PALETTE.emerald; 
    const cGold = PALETTE.gold;
    return sampleRegions([
        { weight: 30, color: cBody, generator: () => getBoxPoint(size - 0.2, size - 0.2, size - 0.2, center) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, size, edgeThick, center.clone().add(new THREE.Vector3(half, 0, half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, size, edgeThick, center.clone().add(new THREE.Vector3(-half, 0, half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, size, edgeThick, center.clone().add(new THREE.Vector3(half, 0, -half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, size, edgeThick, center.clone().add(new THREE.Vector3(-half, 0, -half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(size, edgeThick, edgeThick, center.clone().add(new THREE.Vector3(0, half, half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(size, edgeThick, edgeThick, center.clone().add(new THREE.Vector3(0, half, -half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, edgeThick, size, center.clone().add(new THREE.Vector3(half, half, 0))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, edgeThick, size, center.clone().add(new THREE.Vector3(-half, half, 0))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(size, edgeThick, edgeThick, center.clone().add(new THREE.Vector3(0, -half, half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(size, edgeThick, edgeThick, center.clone().add(new THREE.Vector3(0, -half, -half))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, edgeThick, size, center.clone().add(new THREE.Vector3(half, -half, 0))) },
        { weight: 2, color: cGold, generator: () => getBoxPoint(edgeThick, edgeThick, size, center.clone().add(new THREE.Vector3(-half, -half, 0))) },
        { weight: 5, color: cGold, generator: () => getBoxPoint(1.2, size + 0.1, size + 0.1, center) },
        { weight: 5, color: cGold, generator: () => getBoxPoint(size + 0.1, size + 0.1, 1.2, center) },
        { weight: 4, color: cGold, generator: () => getBezierTubePoint(new THREE.Vector3(0, half, 0).add(center), new THREE.Vector3(2.0, half + 2.0, 0).add(center), new THREE.Vector3(3.0, half + 0.5, 0).add(center), new THREE.Vector3(0, half, 0).add(center), 0.5, 0.1) },
        { weight: 4, color: cGold, generator: () => getBezierTubePoint(new THREE.Vector3(0, half, 0).add(center), new THREE.Vector3(-2.0, half + 2.0, 0).add(center), new THREE.Vector3(-3.0, half + 0.5, 0).add(center), new THREE.Vector3(0, half, 0).add(center), 0.5, 0.1) }
    ]);
};

const getBranchPoint = (start: THREE.Vector3, end: THREE.Vector3, thickness: number): THREE.Vector3 => {
    const t = Math.random();
    const center = start.clone().lerp(end, t);
    const r = thickness * (1.0 - t * 0.5); 
    return center.add(getRandomSpherePoint(r));
}

export const getElkPoint = (): ShapeData => {
  const headCenter = new THREE.Vector3(3.0, 7.5, 0);
  return sampleRegions([
    { weight: 8, color: PALETTE.brown, generator: () => {
         const p = getRandomSpherePoint(1.0);
         return new THREE.Vector3(p.x * 2.8, p.y * 1.6 + 4.5, p.z * 1.5);
      } 
    },
    { weight: 5, color: PALETTE.brown, generator: () => getBezierTubePoint(new THREE.Vector3(1.5, 5.0, 0), new THREE.Vector3(2.2, 6.0, 0), new THREE.Vector3(2.6, 6.8, 0), new THREE.Vector3(3.0, 7.3, 0), 1.6, 1.0) },
    { weight: 3, color: PALETTE.brown, generator: () => getRandomSpherePoint(1.1).add(headCenter) },
    { weight: 1, color: PALETTE.darkBrown, generator: () => getBoxPoint(1.0, 0.7, 0.7, headCenter.clone().add(new THREE.Vector3(0.8, -0.2, 0))) },
    { weight: 1.5, color: PALETTE.brown, generator: () => getCylinderPoint(3.5, 0.4, 0).add(new THREE.Vector3(1.8, 0, 0.8)) }, 
    { weight: 1.5, color: PALETTE.brown, generator: () => getCylinderPoint(3.5, 0.4, 0).add(new THREE.Vector3(1.8, 0, -0.8)) },
    { weight: 1.5, color: PALETTE.brown, generator: () => getCylinderPoint(3.5, 0.4, 0).add(new THREE.Vector3(-1.8, 0, 0.8)) },
    { weight: 1.5, color: PALETTE.brown, generator: () => getCylinderPoint(3.5, 0.4, 0).add(new THREE.Vector3(-1.8, 0, -0.8)) },
    { weight: 3, color: PALETTE.goldLight, generator: () => {
        const zSide = Math.random() > 0.5 ? 1 : -1;
        const origin = headCenter.clone().add(new THREE.Vector3(0, 0.8, 0.4 * zSide));
        const r = Math.random();
        if (r < 0.5) return getBranchPoint(origin, origin.clone().add(new THREE.Vector3(-1.5, 2.5, 0.8 * zSide)), 0.15);
        else {
             const beam = origin.clone().add(new THREE.Vector3(-0.5, 0.8, 0.3*zSide));
             return getBranchPoint(beam, beam.clone().add(new THREE.Vector3(0.5, 1.0, 0)), 0.1);
        }
    }},
    { weight: 0.5, color: PALETTE.white, generator: () => getRandomSpherePoint(0.5).add(new THREE.Vector3(-2.9, 5.2, 0)) }
  ]);
};

export const getTextPoint = (index: number, total: number, colorStr: string): ShapeData => {
    const customColor = new THREE.Color(colorStr);
    const { pos } = getGradientTextPoint("MERRY\nCHRISTMAS", "700 {size} 'Cinzel', serif", index, 1.0, customColor, customColor, 20);
    return { pos, color: customColor };
};

export const getAnkermakerPoint = (index: number, total: number, colorStr: string): ShapeData => {
    const customColor = new THREE.Color(colorStr);
    const accent = customColor.clone().offsetHSL(0, 0, -0.2); 
    return getGradientTextPoint("Ankermaker", "900 {size} 'Arial Black', sans-serif", index, 1.5, customColor, accent, 18);
};

export const getAnkerPoint = (index: number, total: number, colorStr: string): ShapeData => {
    const customColor = new THREE.Color(colorStr);
    const accent = customColor.clone().offsetHSL(0, 0, -0.2); 
    return getGradientTextPoint("ANKER", "900 {size} 'Arial Black', 'Inter', sans-serif", index, 1.5, customColor, accent, 15);
};

export const getSoundcorePoint = (index: number, total: number, colorStr: string): ShapeData => {
    const customColor = new THREE.Color(colorStr);
    const accent = customColor.clone().offsetHSL(0, 0, -0.2);
    return getGradientTextPoint("soundcore", "700 {size} 'Arial', sans-serif", index, 1.5, customColor, accent, 22);
};

export const getEufyPoint = (index: number, total: number, colorStr: string): ShapeData => {
    const customColor = new THREE.Color(colorStr);
    const accent = customColor.clone().offsetHSL(0, 0, -0.2);
    return getGradientTextPoint("eufy", "700 {size} 'Arial', sans-serif", index, 1.5, customColor, accent, 10); 
};
