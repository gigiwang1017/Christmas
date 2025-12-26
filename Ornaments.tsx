
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, OrnamentData, AppConfig, FormationType } from '../types';
import { getRandomSpherePoint, getTreePoint, getElkPoint, PALETTE } from '../utils/math';

interface OrnamentsProps {
  state: AppState;
  config: AppConfig;
}

const ORNAMENT_COUNT = 350;

export const Ornaments: React.FC<OrnamentsProps> = ({ state, config }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const { height, radius, spirals } = config.tree;
  const { formation } = config;
  const globalScaleMult = config.ornamentScale;

  // Chaos Positions and Base Colors
  const { chaosPositions, baseColors, types } = useMemo(() => {
    const chaosPositions = new Float32Array(ORNAMENT_COUNT * 3);
    const baseColors = new Float32Array(ORNAMENT_COUNT * 3);
    const types: ('heavy' | 'medium' | 'light')[] = [];

    for (let i = 0; i < ORNAMENT_COUNT; i++) {
      const cPos = getRandomSpherePoint(12);
      chaosPositions[i * 3] = cPos.x;
      chaosPositions[i * 3 + 1] = cPos.y;
      chaosPositions[i * 3 + 2] = cPos.z;

      const rand = Math.random();
      let type: 'heavy' | 'medium' | 'light' = 'medium';
      let color = PALETTE.gold;

      if (rand > 0.75) {
        type = 'heavy';
        color = Math.random() > 0.5 ? PALETTE.gold : PALETTE.red;
      } else if (rand > 0.35) {
        type = 'medium';
        color = Math.random() > 0.5 ? PALETTE.silver : PALETTE.goldLight;
      } else {
        type = 'light';
        color = new THREE.Color('#FF6600'); 
      }
      
      types.push(type);
      baseColors[i * 3] = color.r;
      baseColors[i * 3 + 1] = color.g;
      baseColors[i * 3 + 2] = color.b;
    }
    return { chaosPositions, baseColors, types };
  }, []);

  const targets = useMemo(() => ({
    positions: new Float32Array(ORNAMENT_COUNT * 3),
    colors: new Float32Array(ORNAMENT_COUNT * 3)
  }), []);

  useEffect(() => {
    const tPos = targets.positions;
    const tCol = targets.colors;
    const isAnyTree = [FormationType.TREE, FormationType.PINK_TREE, FormationType.RED_TREE].includes(formation);

    for (let i = 0; i < ORNAMENT_COUNT; i++) {
      let vec = new THREE.Vector3();
      let col = new THREE.Color(baseColors[i*3], baseColors[i*3+1], baseColors[i*3+2]);

      if (isAnyTree) {
        vec = getTreePoint(height * 0.9, radius * 1.05, spirals, -2 + 0.5);
        if (formation === FormationType.PINK_TREE) {
           const r = Math.random();
           if (r > 0.7) col.set('#FFFFFF');
           else if (r > 0.4) col.set('#8A2BE2');
           else col.set('#FF1493');
        } else if (formation === FormationType.RED_TREE) {
           const r = Math.random();
           if (r > 0.6) col.set(PALETTE.gold);
           else col.set('#800000');
        }
      } else if (formation === FormationType.ELK) {
        const d = getElkPoint();
        vec = d.pos;
      } else {
        vec.set(chaosPositions[i*3], chaosPositions[i*3+1], chaosPositions[i*3+2]);
      }

      tPos[i * 3] = vec.x;
      tPos[i * 3 + 1] = vec.y;
      tPos[i * 3 + 2] = vec.z;
      tCol[i * 3] = col.r;
      tCol[i * 3 + 1] = col.g;
      tCol[i * 3 + 2] = col.b;
    }
  }, [formation, height, radius, spirals, targets, baseColors, chaosPositions]);

  const currentPositions = useRef(new Float32Array(ORNAMENT_COUNT * 3));
  const currentColors = useRef(new Float32Array(ORNAMENT_COUNT * 3));
  const currentScales = useRef(new Float32Array(ORNAMENT_COUNT));
  
  useMemo(() => {
    currentPositions.current.set(chaosPositions);
    currentColors.current.set(baseColors);
    for(let i=0; i<ORNAMENT_COUNT; i++) {
       let s = 0.1;
       if (types[i] === 'heavy') s = 0.15;
       if (types[i] === 'light') s = 0.04;
       currentScales.current[i] = s;
    }
  }, [chaosPositions, baseColors, types]);

  useFrame((rootState, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    const isFormed = state === AppState.FORMED;
    const globalSpeed = config.particles.speed;
    const formationExposure = config.formationExposures[formation] ?? 1.0;

    // 关键修复：调节材质发射强度模拟曝光
    materialRef.current.emissiveIntensity = 0.5 * formationExposure;

    const tPos = targets.positions;
    const cPos = currentPositions.current;
    const cScale = currentScales.current;
    const isAnyTree = [FormationType.TREE, FormationType.PINK_TREE, FormationType.RED_TREE].includes(formation);

    for (let i = 0; i < ORNAMENT_COUNT; i++) {
      const idx = i * 3;
      const tx = isFormed ? tPos[idx] : chaosPositions[idx];
      const ty = isFormed ? tPos[idx + 1] : chaosPositions[idx + 1];
      const tz = isFormed ? tPos[idx + 2] : chaosPositions[idx + 2];

      let x = cPos[idx];
      let y = cPos[idx + 1];
      let z = cPos[idx + 2];

      let lerpSpeed = (types[i] === 'heavy' ? 0.8 : (types[i] === 'light' ? 3.0 : 2.0)) * globalSpeed;

      x += (tx - x) * lerpSpeed * delta;
      y += (ty - y) * lerpSpeed * delta;
      z += (tz - z) * lerpSpeed * delta;

      let targetScale = (isAnyTree || formation === FormationType.ELK) ? (types[i] === 'heavy' ? 0.15 : (types[i] === 'light' ? 0.04 : 0.1)) : 0.0;
      let s = cScale[i];
      s += (targetScale - s) * lerpSpeed * delta;
      
      cPos[idx] = x; cPos[idx+1] = y; cPos[idx+2] = z; cScale[i] = s;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(s * globalScaleMult);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, new THREE.Color(currentColors.current[idx], currentColors.current[idx+1], currentColors.current[idx+2]));
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ORNAMENT_COUNT]}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial 
        ref={materialRef}
        toneMapped={false}
        metalness={0.95}
        roughness={0.1}
        envMapIntensity={2.0}
      />
    </instancedMesh>
  );
};
