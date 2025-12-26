import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType } from '../types';
import { 
  getRandomSpherePoint, 
  getTreePoint, 
  getHatPoint, 
  getStockingPoint, 
  getTextPoint, 
  getAnkermakerPoint,
  getElkPoint, 
  getAnkerPoint, 
  getSoundcorePoint, 
  getSantaPoint, 
  getEufyPoint,
  getGiftPoint,
  postProcessStockingColor,
  postProcessGiftColor,
  getCanvasImagePoints,
  getVolumetricShapePoint
} from '../utils/math';

interface FoliageProps {
  state: AppState;
  config: AppConfig;
}

const vertexShader = `
  uniform float uSizeScale;
  uniform vec3 uMouse;
  uniform float uRepulseRadius;
  uniform float uRepulseStrength;
  uniform int uRepulseType;
  uniform float uTime;
  
  attribute float size;
  attribute float type; 
  varying vec3 vColor;
  varying float vType;
  varying float vShimmer;

  void main() {
    vColor = color;
    vType = type;
    
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    float shimmer = sin(uTime * 2.0 + position.x * 10.0 + position.y * 10.0) * 0.5 + 0.5;
    vShimmer = shimmer;

    float dist = distance(worldPosition.xyz, uMouse);
    if (dist < uRepulseRadius) {
       vec3 dir = normalize(worldPosition.xyz - uMouse);
       float force = 0.0;
       if (uRepulseType == 0) force = (1.0 - dist / uRepulseRadius) * uRepulseStrength;
       else if (uRepulseType == 1) force = exp(-pow(dist / uRepulseRadius, 2.0) * 4.0) * uRepulseStrength;
       else {
           force = exp(-pow(dist / uRepulseRadius, 2.0) * 3.0) * uRepulseStrength;
           vec3 curl = cross(dir, vec3(sin(uTime + position.y), cos(uTime + position.x), 0.0));
           dir = normalize(mix(dir, curl, 0.3));
       }
       worldPosition.xyz += dir * force;
    }
    
    vec4 mvPosition = viewMatrix * worldPosition;
    float pSize = size * uSizeScale * (400.0 / max(1.0, -mvPosition.z));
    gl_PointSize = min(60.0, pSize);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vType;
  varying float vShimmer;
  uniform float uBrightness;
  uniform float uIsSanta;
  uniform float uIsSakura;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float glow = exp(-dist * 6.0);
    
    if (uIsSakura > 0.5) {
       float angle = atan(coord.y, coord.x);
       float r = 0.3 + 0.15 * cos(angle * 5.0);
       float shape = smoothstep(r, r - 0.05, dist);
       glow *= shape * 1.5;
       float core = smoothstep(0.1, 0.0, dist);
       glow += core * 0.5;
    } else if (vType > 0.5 && vType < 1.5) {
       float star = 0.02 / (abs(coord.x) + 0.005) * (1.0 - abs(coord.y)*2.0);
       star += 0.02 / (abs(coord.y) + 0.005) * (1.0 - abs(coord.x)*2.0);
       glow += star;
    }

    float finalAlpha = glow * mix(0.7, 1.0, vShimmer);
    
    float currentBrightness = uBrightness;
    if (uIsSanta > 0.5 && vColor.r > 0.8 && vColor.g < 0.2 && vColor.b < 0.2) {
        currentBrightness *= 1.15;
    }

    gl_FragColor = vec4(vColor * currentBrightness, clamp(finalAlpha, 0.0, 1.0));
  }
`;

export const Foliage: React.FC<FoliageProps> = ({ state, config }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const [logoPointCache, setLogoPointCache] = useState<Map<FormationType, THREE.Vector3[]>>(new Map());
  
  const { count, repulsionStrength, repulsionRadius, repulsionType } = config.particles;
  const formation = config.formation;

  useEffect(() => {
    Object.entries(config.customLogos).forEach(([type, url]) => {
      const fType = type as FormationType;
      if (url && typeof url === 'string') {
        getCanvasImagePoints(url).then(points => {
          if (points && points.length > 0) {
            setLogoPointCache(prev => {
              const next = new Map(prev);
              next.set(fType, points);
              return next;
            });
          }
        });
      }
    });
  }, [config.customLogos]);
  
  const { positions, colors, sizes, types, chaosPositions, speeds, fireworkPositions } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const tp = new Float32Array(count); 
    const cp = new Float32Array(count * 3);
    const fp = new Float32Array(count * 3);
    const spd = new Float32Array(count);

    const cEmerald = new THREE.Color(config.colors.emerald);
    const cGold = new THREE.Color(config.colors.gold);
    const cRed = new THREE.Color(config.colors.red);

    for (let i = 0; i < count; i++) {
      const p = getRandomSpherePoint(18);
      cp[i*3] = p.x; cp[i*3+1] = p.y; cp[i*3+2] = p.z;
      
      const r = 10.0 + Math.random() * 30.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      fp[i*3] = r * Math.sin(phi) * Math.cos(theta);
      fp[i*3+1] = r * Math.cos(phi) + 2.5;
      fp[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

      pos[i*3] = cp[i*3]; pos[i*3+1] = cp[i*3+1]; pos[i*3+2] = cp[i*3+2];

      const rand = Math.random();
      let color = cEmerald;
      let type = 0.0;
      let size = Math.random() * 0.12 + 0.04;

      if (rand > 0.96) { type = 1.0; color = cGold; size *= 2.5; }
      else if (rand > 0.92) { type = 2.0; color = cRed; }
      else if (Math.random() > 0.6) color = new THREE.Color('#001a14');

      col[i*3] = color.r; col[i*3+1] = color.g; col[i*3+2] = color.b;
      sz[i] = size; tp[i] = type; spd[i] = Math.random() * 0.025 + 0.01;
    }
    return { positions: pos, colors: col, sizes: sz, types: tp, chaosPositions: cp, fireworkPositions: fp, speeds: spd };
  }, [count, config.colors]);

  const targetData = useMemo(() => ({
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3)
  }), [count]);

  useEffect(() => {
    const tPos = targetData.positions;
    const tCol = targetData.colors;
    const cEmerald = new THREE.Color(config.colors.emerald);
    const cPink = new THREE.Color('#FFB7C5'); 
    const cMagenta = new THREE.Color('#FF1493'); 
    const cCrimson = new THREE.Color('#DC143C');

    const getDynamicTextPoint = (type: FormationType, index: number, total: number) => {
      let colorValue = config.colors.text;
      if (type === FormationType.ANKER) colorValue = config.colors.anker;
      else if (type === FormationType.ANKERMAKER) colorValue = config.colors.ankermaker;
      else if (type === FormationType.SOUNDCORE) colorValue = config.colors.soundcore;
      else if (type === FormationType.EUFY) colorValue = config.colors.eufy;
      
      const customColor = new THREE.Color(colorValue);
      const customPoints = logoPointCache.get(type);
      if (customPoints && customPoints.length > 0) {
          const pos = getVolumetricShapePoint(customPoints, index, 1.5);
          return { pos, color: customColor };
      }

      switch (type) {
        case FormationType.ANKERMAKER: return getAnkermakerPoint(index, total, colorValue);
        case FormationType.ANKER: return getAnkerPoint(index, total, colorValue);
        case FormationType.SOUNDCORE: return getSoundcorePoint(index, total, colorValue);
        case FormationType.EUFY: return getEufyPoint(index, total, colorValue);
        default: return getTextPoint(index, total, colorValue);
      }
    };
    
    for (let i = 0; i < count; i++) {
      let pt = new THREE.Vector3();
      let color = cEmerald;

      switch(formation) {
        case FormationType.HAT: { const d = getHatPoint(); pt = d.pos; color = d.color; break; }
        case FormationType.STOCKING: { const d = getStockingPoint(); pt = d.pos.multiplyScalar(1.1); color = postProcessStockingColor(pt, d.color); break; }
        case FormationType.SANTA: { const d = getSantaPoint(); pt = d.pos.multiplyScalar(1.1); color = d.color; break; }
        case FormationType.PINK_TREE: {
            pt = getTreePoint(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, -2.0, config.tree.densityBias);
            const r = Math.random();
            if (r > 0.9) color = new THREE.Color('#FFFFFF'); 
            else if (r > 0.6) color = cMagenta;
            else if (r < 0.2) color = new THREE.Color('#FFF0F5'); 
            else color = cPink;
            break;
        }
        case FormationType.RED_TREE: {
            pt = getTreePoint(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, -2.0, config.tree.densityBias);
            const r = Math.random();
            if (r > 0.96) color = new THREE.Color(config.colors.gold);
            else if (r > 0.8) color = new THREE.Color('#8B0000'); 
            else if (r < 0.2) color = new THREE.Color('#FF4500'); 
            else color = cCrimson;
            break;
        }
        case FormationType.GIFT: { const d = getGiftPoint(); pt = d.pos; color = postProcessGiftColor(pt, d.color); break; }
        case FormationType.TEXT:
        case FormationType.ANKERMAKER:
        case FormationType.ANKER:
        case FormationType.SOUNDCORE:
        case FormationType.EUFY: { const d = getDynamicTextPoint(formation, i, count); pt = d.pos; color = d.color; break; }
        case FormationType.ELK: { const d = getElkPoint(); pt = d.pos; color = d.color; break; }
        default: {
            pt = getTreePoint(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, -2.0, config.tree.densityBias);
            if (Math.random() > 0.95) color = new THREE.Color(config.colors.gold);
            else if (Math.random() < 0.5) color = new THREE.Color('#001a14');
        }
      }
      tPos[i*3] = pt.x; tPos[i*3+1] = pt.y; tPos[i*3+2] = pt.z;
      tCol[i*3] = color.r; tCol[i*3+1] = color.g; tCol[i*3+2] = color.b;
    }
  }, [formation, config.tree, count, config.colors, logoPointCache]);

  const uniforms = useMemo(() => ({
    uSizeScale: { value: 1.0 },
    uMouse: { value: new THREE.Vector3(999, 999, 999) },
    uRepulseRadius: { value: 4.0 },
    uRepulseStrength: { value: 5.0 },
    uRepulseType: { value: 2 },
    uBrightness: { value: 2.0 }, 
    uTime: { value: 0 },
    uIsSanta: { value: 0 },
    uIsSakura: { value: 0 }
  }), []);

  useFrame((rootState, delta) => {
    if (!pointsRef.current) return;
    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    if (!mat.uniforms) return;
    
    mat.uniforms.uTime.value = rootState.clock.elapsedTime;
    mat.uniforms.uSizeScale.value = config.particles.size;
    
    const isHighDetail = [FormationType.TEXT, FormationType.ANKERMAKER, FormationType.ANKER, FormationType.SOUNDCORE, FormationType.EUFY, FormationType.SANTA, FormationType.PINK_TREE, FormationType.RED_TREE].includes(formation);
    
    const formationExposure = config.formationExposures?.[formation] ?? 1.0;
    mat.uniforms.uBrightness.value = (isHighDetail ? 3.0 : 2.0) * formationExposure;
    
    mat.uniforms.uIsSanta.value = formation === FormationType.SANTA ? 1.0 : 0.0;
    mat.uniforms.uIsSakura.value = formation === FormationType.PINK_TREE ? 1.0 : 0.0;

    mat.uniforms.uRepulseRadius.value = repulsionRadius;
    mat.uniforms.uRepulseStrength.value = repulsionStrength;
    mat.uniforms.uRepulseType.value = repulsionType === 'gaussian' ? 1 : (repulsionType === 'linear' ? 0 : 2);

    const mouseNdc = new THREE.Vector2(rootState.pointer.x, rootState.pointer.y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseNdc, rootState.camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersect)) mat.uniforms.uMouse.value.copy(intersect);

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute;
    const isFormed = state === AppState.FORMED;
    const isFirework = !isFormed && formation === FormationType.GIFT;

    const lerpSpeedBase = delta * 60 * config.particles.speed;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let tx = isFormed ? targetData.positions[idx] : (isFirework ? fireworkPositions[idx] : chaosPositions[idx]);
      let ty = isFormed ? targetData.positions[idx+1] : (isFirework ? fireworkPositions[idx+1] : chaosPositions[idx+1]);
      let tz = isFormed ? targetData.positions[idx+2] : (isFirework ? fireworkPositions[idx+2] : chaosPositions[idx+2]);

      const lerpSpeed = speeds[i] * lerpSpeedBase * (isFirework ? 3.0 : 1.0);
      posAttr.array[idx] += (tx - posAttr.array[idx]) * lerpSpeed;
      posAttr.array[idx+1] += (ty - posAttr.array[idx+1]) * lerpSpeed;
      posAttr.array[idx+2] += (tz - posAttr.array[idx+2]) * lerpSpeed;

      if (isFormed) {
        colAttr.array[idx] += (targetData.colors[idx] - colAttr.array[idx]) * lerpSpeed * 0.5;
        colAttr.array[idx+1] += (targetData.colors[idx+1] - colAttr.array[idx+1]) * lerpSpeed * 0.5;
        colAttr.array[idx+2] += (targetData.colors[idx+2] - colAttr.array[idx+2]) * lerpSpeed * 0.5;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} key={count}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length/3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length/3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-type" count={types.length} array={types} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexColors />
    </points>
  );
};