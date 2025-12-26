
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType } from '../types';
import { getRandomSpherePoint, PALETTE } from '../utils/math';

interface RibbonConfettiProps {
  state: AppState;
  config: AppConfig;
}

const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  uniform float uSizeScale;
  
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float zDist = max(1.0, -mvPosition.z);
    float pSize = size * uSizeScale * (300.0 / zDist);
    gl_PointSize = min(60.0, pSize);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  uniform float uBrightness;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
    // 关键点：应用亮度倍率
    gl_FragColor = vec4((vColor + 0.3) * uBrightness, alpha);
  }
`;

export const RibbonConfetti: React.FC<RibbonConfettiProps> = ({ state, config }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  const { height, radius } = config.tree;
  const { radiusMult, turns, width, spinSpeed } = config.ribbon;
  const { count, size, spread, randomness } = config.ribbonConfetti;
  const { formation } = config;

  const isAnyTree = [FormationType.TREE, FormationType.PINK_TREE, FormationType.RED_TREE].includes(formation);

  const { chaosPositions, sizes, speeds } = useMemo(() => {
    const chaosPositions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const cPos = getRandomSpherePoint(15);
      chaosPositions[i * 3] = cPos.x;
      chaosPositions[i * 3 + 1] = cPos.y;
      chaosPositions[i * 3 + 2] = cPos.z;

      sizes[i] = Math.random() * 0.5 + 0.5;
      speeds[i] = Math.random() * 0.02 + 0.01;
    }
    return { chaosPositions, sizes, speeds };
  }, [count]);

  const targetData = useMemo(() => ({
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3)
  }), [count]);

  const currentData = useMemo(() => ({
    positions: new Float32Array(chaosPositions),
    colors: new Float32Array(count * 3).fill(1.0)
  }), [chaosPositions, count]);

  const animScale = useRef(0.0);

  useEffect(() => {
    const tPos = targetData.positions;
    const tCol = targetData.colors;
    
    const goldColor = new THREE.Color(config.colors.gold);
    const redColor = new THREE.Color(config.colors.red);
    const magentaColor = new THREE.Color('#FF1493');
    const whiteColor = new THREE.Color('#FFFFFF');

    for (let i = 0; i < count; i++) {
      let vec = new THREE.Vector3();
      let col = new THREE.Color();

      if (isAnyTree) {
         const t = i / count; 
         const tRand = t + (Math.random() - 0.5) * 0.1;
         const y = tRand * height * 1.1 - 2; 
         const normalizedH = Math.max(0, Math.min(1, (y + 2) / height));
         const treeRadiusAtH = radius * (1.0 - normalizedH);
         const r = Math.max(0.1, treeRadiusAtH * radiusMult) + (Math.random() - 0.5) * spread;
         const angle = tRand * Math.PI * 2 * turns + (Math.random() - 0.5) * spread;
         vec.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

         const rand = Math.random();
         if (formation === FormationType.PINK_TREE) {
            col.copy(rand > 0.6 ? magentaColor : (rand > 0.3 ? whiteColor : new THREE.Color('#FFB6C1')));
         } else if (formation === FormationType.RED_TREE) {
            col.copy(rand > 0.7 ? goldColor : (rand > 0.3 ? new THREE.Color('#9B111E') : new THREE.Color('#FF0000')));
         } else {
            col.copy(rand > 0.6 ? goldColor : (rand > 0.3 ? redColor : PALETTE.silver));
         }
      } else {
         vec.set(chaosPositions[i*3], chaosPositions[i*3+1], chaosPositions[i*3+2]);
         col.setHex(0xFFD700);
      }

      tPos[i * 3] = vec.x; tPos[i * 3 + 1] = vec.y; tPos[i * 3 + 2] = vec.z;
      tCol[i * 3] = col.r; tCol[i * 3 + 1] = col.g; tCol[i * 3 + 2] = col.b;
    }
  }, [formation, height, radius, radiusMult, turns, width, count, spread, config.colors, targetData, chaosPositions]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    if (groupRef.current) groupRef.current.rotation.y -= delta * spinSpeed;

    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    // 关键点：实时更新亮度 Uniform
    const formationExposure = config.formationExposures[formation] ?? 1.0;
    mat.uniforms.uBrightness = { value: 1.0 * formationExposure };

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute;

    const isFormed = state === AppState.FORMED;
    const globalSpeed = config.particles.speed;
    const arrPos = posAttr.array as Float32Array;
    const arrCol = colAttr.array as Float32Array;

    const targetScale = (isFormed && isAnyTree) ? 1.0 : 0.0;
    animScale.current += (targetScale - animScale.current) * delta * 2.0;
    mat.uniforms.uSizeScale = { value: size * animScale.current };

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const tx = isFormed ? targetData.positions[idx] : chaosPositions[idx];
      const ty = isFormed ? targetData.positions[idx + 1] : chaosPositions[idx + 1];
      const tz = isFormed ? targetData.positions[idx + 2] : chaosPositions[idx + 2];
      
      const speed = speeds[i] * (delta * 60) * globalSpeed * 2.0;
      arrPos[idx] += (tx - arrPos[idx]) * speed;
      arrPos[idx + 1] += (ty - arrPos[idx + 1]) * speed;
      arrPos[idx + 2] += (tz - arrPos[idx + 2]) * speed;

      arrCol[idx] += (targetData.colors[idx] - arrCol[idx]) * speed * 0.5;
      arrCol[idx + 1] += (targetData.colors[idx+1] - arrCol[idx + 1]) * speed * 0.5;
      arrCol[idx + 2] += (targetData.colors[idx+2] - arrCol[idx + 2]) * speed * 0.5;
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(currentData.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(currentData.colors, 3));
    const rndSizes = new Float32Array(count);
    for(let i=0; i<count; i++) rndSizes[i] = sizes[i] * (1.0 + (Math.random()-0.5) * randomness);
    geo.setAttribute('size', new THREE.BufferAttribute(rndSizes, 1));
    return geo;
  }, [currentData, sizes, randomness, count]);

  return (
    <group ref={groupRef} visible={isAnyTree}>
      <points ref={pointsRef} geometry={geometry}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexColors
          uniforms={{ uSizeScale: { value: 0 }, uBrightness: { value: 1.0 } }}
        />
      </points>
    </group>
  );
};
