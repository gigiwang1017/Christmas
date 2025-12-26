
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType } from '../types';
import { getRandomSpherePoint } from '../utils/math';

interface SpiralRibbonProps {
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
    float pSize = size * uSizeScale * (400.0 / zDist);
    gl_PointSize = min(60.0, pSize);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uIsSakura;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float shapeAlpha = 1.0;
    if (uIsSakura > 0.5) {
       float angle = atan(coord.y, coord.x);
       float r = 0.3 + 0.15 * cos(angle * 5.0);
       shapeAlpha = smoothstep(r, r - 0.05, dist);
    } else {
       shapeAlpha = 1.0 - smoothstep(0.1, 0.5, dist);
    }
    
    gl_FragColor = vec4(vColor * uBrightness, shapeAlpha * 0.8 * uOpacity);
  }
`;

const RibbonTrailLayer: React.FC<{
  geometry: THREE.BufferGeometry;
  rotationOffset: number;
  opacity: number;
  particleSize: number;
  brightness: number;
  isSakura: boolean;
}> = ({ geometry, rotationOffset, opacity, particleSize, brightness, isSakura }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const propsRef = useRef({ particleSize, opacity, brightness, isSakura });
  propsRef.current = { particleSize, opacity, brightness, isSakura };

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uSizeScale.value = propsRef.current.particleSize;
      materialRef.current.uniforms.uOpacity.value = propsRef.current.opacity;
      materialRef.current.uniforms.uBrightness.value = propsRef.current.brightness;
      materialRef.current.uniforms.uIsSakura.value = propsRef.current.isSakura ? 1.0 : 0.0;
    }
  });

  return (
    <points geometry={geometry} rotation={[0, rotationOffset, 0]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        uniforms={{
          uSizeScale: { value: particleSize },
          uOpacity: { value: opacity },
          uBrightness: { value: brightness },
          uIsSakura: { value: isSakura ? 1.0 : 0.0 }
        }}
      />
    </points>
  );
};

export const SpiralRibbon: React.FC<SpiralRibbonProps> = ({ state, config }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  const { height, radius } = config.tree;
  const { radiusMult, turns, width, particleCount, particleSize, spinSpeed, trailLength, trailSpread, brightness } = config.ribbon;
  const { formation } = config;

  const isAnyTree = [FormationType.TREE, FormationType.PINK_TREE, FormationType.RED_TREE].includes(formation);
  const isSakura = formation === FormationType.PINK_TREE;

  const { chaosPositions, sizes, speeds } = useMemo(() => {
    const chaosPositions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const cPos = getRandomSpherePoint(15);
      chaosPositions[i * 3] = cPos.x;
      chaosPositions[i * 3 + 1] = cPos.y;
      chaosPositions[i * 3 + 2] = cPos.z;

      sizes[i] = Math.random() * 0.4 + 0.2;
      speeds[i] = Math.random() * 0.02 + 0.01;
    }
    return { chaosPositions, sizes, speeds };
  }, [particleCount]);

  const targetData = useMemo(() => ({
    positions: new Float32Array(particleCount * 3),
    colors: new Float32Array(particleCount * 3)
  }), [particleCount]);

  const currentData = useMemo(() => ({
    positions: new Float32Array(chaosPositions),
    colors: new Float32Array(particleCount * 3).fill(1.0)
  }), [chaosPositions, particleCount]);

  const animScale = useRef(0.0);

  useEffect(() => {
    const tPos = targetData.positions;
    const tCol = targetData.colors;
    
    const goldColor = new THREE.Color(config.colors.gold);
    const redColor = new THREE.Color(config.colors.red);
    const whiteColor = new THREE.Color('#FFFFFF');
    const sakuraPink = new THREE.Color('#FFC0CB'); 
    const crimsonColor = new THREE.Color('#B22222');

    for (let i = 0; i < particleCount; i++) {
      let vec = new THREE.Vector3();
      let col = new THREE.Color();

      if (isAnyTree) {
         const t = i / particleCount; 
         const spiralHeight = height * 1.1; 
         const y = t * spiralHeight - 2; 
         
         const normalizedH = Math.max(0, Math.min(1, (y + 2) / height));
         const treeRadiusAtH = radius * (1.0 - normalizedH);
         const r = Math.max(0.1, treeRadiusAtH * radiusMult);
         const angle = t * Math.PI * 2 * turns; 
         const widthOffset = (Math.random() - 0.5) * width;
         const x = Math.cos(angle) * (r + widthOffset);
         const z = Math.sin(angle) * (r + widthOffset);
         
         vec.set(x, y, z);

         const mixRatio = Math.sin(t * 10.0) * 0.5 + 0.5; 
         if (formation === FormationType.PINK_TREE) {
            col.copy(whiteColor).lerp(sakuraPink, mixRatio);
         } else if (formation === FormationType.RED_TREE) {
            col.copy(crimsonColor).lerp(whiteColor, mixRatio * 0.4);
         } else {
            col.copy(goldColor).lerp(redColor, mixRatio * 0.3);
         }
      } else {
         vec.set(chaosPositions[i*3], chaosPositions[i*3+1], chaosPositions[i*3+2]);
         col.setHex(0xFFD700); 
      }

      tPos[i * 3] = vec.x;
      tPos[i * 3 + 1] = vec.y;
      tPos[i * 3 + 2] = vec.z;

      tCol[i * 3] = col.r;
      tCol[i * 3 + 1] = col.g;
      tCol[i * 3 + 2] = col.b;
    }
  }, [formation, height, radius, radiusMult, turns, width, particleCount, config.colors, targetData, chaosPositions]);

  const uniforms = useMemo(() => ({
    uSizeScale: { value: 0 }, 
    uOpacity: { value: 1.0 },
    uBrightness: { value: brightness },
    uIsSakura: { value: 0.0 }
  }), []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    
    if (groupRef.current) {
      groupRef.current.rotation.y -= delta * spinSpeed * (isSakura ? 0.7 : 1.0);
    }

    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    // 应用形态曝光
    const formationExposure = config.formationExposures[formation] ?? 1.0;
    mat.uniforms.uBrightness.value = brightness * formationExposure;
    mat.uniforms.uIsSakura.value = isSakura ? 1.0 : 0.0;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute;

    const isFormed = state === AppState.FORMED;
    const globalSpeed = config.particles.speed;

    const tPos = targetData.positions;
    const tCol = targetData.colors;
    
    const arrPos = posAttr.array as Float32Array;
    const arrCol = colAttr.array as Float32Array;

    const targetScale = (isFormed && isAnyTree) ? 1.0 : 0.0;
    animScale.current += (targetScale - animScale.current) * delta * 2.5;
    uniforms.uSizeScale.value = particleSize * animScale.current * (isSakura ? 1.5 : 1.0);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const tx = isFormed ? tPos[idx] : chaosPositions[idx];
      const ty = isFormed ? tPos[idx + 1] : chaosPositions[idx + 1];
      const tz = isFormed ? tPos[idx + 2] : chaosPositions[idx + 2];
      
      const targetR = isFormed ? tCol[idx] : 1.0;
      const targetG = isFormed ? tCol[idx + 1] : 0.8;
      const targetB = isFormed ? tCol[idx + 2] : 0.0;

      const speed = speeds[i] * (delta * 60) * globalSpeed * (isSakura ? 1.2 : 1.5);

      arrPos[idx] += (tx - arrPos[idx]) * speed;
      arrPos[idx + 1] += (ty - arrPos[idx + 1]) * speed;
      arrPos[idx + 2] += (tz - arrPos[idx + 2]) * speed;

      arrCol[idx] += (targetR - arrCol[idx]) * speed * 0.5;
      arrCol[idx + 1] += (targetG - arrCol[idx + 1]) * speed * 0.5;
      arrCol[idx + 2] += (targetB - arrCol[idx + 2]) * speed * 0.5;
    }
    
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(currentData.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(currentData.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [currentData, sizes]);

  const showTrails = isAnyTree && state === AppState.FORMED;
  
  const trailInstances = useMemo(() => {
    return Array.from({ length: Math.max(1, Math.floor(trailLength) + 1) }).map((_, i) => {
      const opacity = Math.pow(0.7, i); 
      const scale = Math.pow(0.9, i); 
      const rotationOffset = i * trailSpread;
      return { key: i, opacity, scale, rotationOffset };
    });
  }, [trailLength, trailSpread]);
  
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
          uniforms={uniforms}
        />
      </points>

      {showTrails && trailInstances.map(({ key, opacity, scale, rotationOffset }) => (
        <RibbonTrailLayer 
          key={key}
          geometry={geometry}
          rotationOffset={rotationOffset}
          opacity={opacity}
          particleSize={particleSize * scale * (isSakura ? 1.5 : 1.0)}
          brightness={brightness * (config.formationExposures[formation] ?? 1.0)}
          isSakura={isSakura}
        />
      ))}
    </group>
  );
};
