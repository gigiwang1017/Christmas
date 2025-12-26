
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType } from '../types';
import { getRandomSpherePoint, PALETTE } from '../utils/math';

interface RibbonOrnamentsProps {
  state: AppState;
  config: AppConfig;
}

// Helper to calculate exact point on spiral for a normalized t [0,1]
// This mirrors the logic in SpiralRibbon for shape consistency
const getSpiralPoint = (t: number, height: number, radius: number, radiusMult: number, turns: number) => {
    const spiralHeight = height * 1.1;
    const y = t * spiralHeight - 2;
    const normalizedH = Math.max(0, Math.min(1, (y + 2) / height));
    const treeRadiusAtH = radius * (1.0 - normalizedH);
    const r = Math.max(0.1, treeRadiusAtH * radiusMult);
    const angle = t * Math.PI * 2 * turns;
    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
};

export const RibbonOrnaments: React.FC<RibbonOrnamentsProps> = ({ state, config }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { height, radius } = config.tree;
  const { radiusMult, turns, ornamentCount, ornamentScale, spinSpeed } = config.ribbon;
  const { formation } = config;

  // Initial Data
  const { chaosPositions, baseColors, rotations } = useMemo(() => {
    const chaosPositions = new Float32Array(ornamentCount * 3);
    const baseColors = new Float32Array(ornamentCount * 3);
    const rotations = [];
    
    const redColor = new THREE.Color(PALETTE.red);
    const goldColor = new THREE.Color(PALETTE.gold);
    const silverColor = new THREE.Color(PALETTE.silver);

    for (let i = 0; i < ornamentCount; i++) {
        const cPos = getRandomSpherePoint(15);
        chaosPositions[i*3] = cPos.x;
        chaosPositions[i*3+1] = cPos.y;
        chaosPositions[i*3+2] = cPos.z;

        let color = goldColor;
        const rand = Math.random();
        if (rand > 0.6) color = redColor;
        else if (rand > 0.4) color = silverColor;

        baseColors[i*3] = color.r;
        baseColors[i*3+1] = color.g;
        baseColors[i*3+2] = color.b;

        rotations.push({
            speed: Math.random() * 2.0,
            axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
            scaleVar: Math.random() * 0.4 + 0.6
        });
    }
    return { chaosPositions, baseColors, rotations };
  }, [ornamentCount]);

  // Target Buffers
  const targets = useMemo(() => ({
    positions: new Float32Array(ornamentCount * 3),
    colors: new Float32Array(ornamentCount * 3)
  }), [ornamentCount]);

  // Update Targets with Unified Spacing Logic
  useEffect(() => {
    const tPos = targets.positions;
    const tCol = targets.colors;

    // 1. Build a Look-Up Table (LUT) for Arc Length
    // We want to sample points evenly along the actual 3D curve length,
    // not just linearly by height (which makes them dense at top).
    const lutSamples = 300;
    const lut: { t: number, len: number }[] = [];
    let totalLen = 0;
    let prevP = getSpiralPoint(0, height, radius, radiusMult, turns);
    
    lut.push({ t: 0, len: 0 });

    for (let k = 1; k <= lutSamples; k++) {
        const t = k / lutSamples;
        const p = getSpiralPoint(t, height, radius, radiusMult, turns);
        const dist = p.distanceTo(prevP);
        totalLen += dist;
        lut.push({ t, len: totalLen });
        prevP = p;
    }

    // Function to get 't' for a given target length
    const getTForLength = (targetLen: number) => {
        // Find index where len >= targetLen
        // Simple linear scan is fast enough for 300 items
        for (let k = 0; k < lut.length - 1; k++) {
             if (lut[k+1].len >= targetLen) {
                 // Interpolate
                 const dLen = lut[k+1].len - lut[k].len;
                 const frac = (targetLen - lut[k].len) / dLen;
                 return lut[k].t + frac * (lut[k+1].t - lut[k].t);
             }
        }
        return 1.0;
    };

    for (let i = 0; i < ornamentCount; i++) {
        let vec = new THREE.Vector3();
        let col = new THREE.Color(baseColors[i*3], baseColors[i*3+1], baseColors[i*3+2]);

        if (formation === FormationType.TREE) {
            // Get position based on unified spacing
            const fraction = i / (ornamentCount - 1 || 1);
            const targetLength = fraction * totalLen;
            const t = getTForLength(targetLength);
            
            vec = getSpiralPoint(t, height, radius, radiusMult, turns);
        } else {
             // For non-TREE formations, scatter back to chaos positions
             vec.set(chaosPositions[i*3], chaosPositions[i*3+1], chaosPositions[i*3+2]);
        }

        tPos[i*3] = vec.x;
        tPos[i*3+1] = vec.y;
        tPos[i*3+2] = vec.z;

        tCol[i*3] = col.r;
        tCol[i*3+1] = col.g;
        tCol[i*3+2] = col.b;
    }
  }, [formation, height, radius, radiusMult, turns, targets, baseColors, chaosPositions, ornamentCount]);

  // Current State
  const currentPositions = useRef(new Float32Array(chaosPositions));
  // Scale state for smooth transition
  const currentScales = useRef(new Float32Array(ornamentCount).fill(1.0)); 

  useFrame((_, delta) => {
    if (groupRef.current) {
        groupRef.current.rotation.y -= delta * spinSpeed;
    }

    if (!meshRef.current) return;

    const isFormed = state === AppState.FORMED;
    const globalSpeed = config.particles.speed;
    const tPos = targets.positions;
    const tCol = targets.colors;
    const cPos = currentPositions.current;
    const cScale = currentScales.current;

    for (let i = 0; i < ornamentCount; i++) {
        const idx = i * 3;
        
        const tx = isFormed ? tPos[idx] : chaosPositions[idx];
        const ty = isFormed ? tPos[idx+1] : chaosPositions[idx+1];
        const tz = isFormed ? tPos[idx+2] : chaosPositions[idx+2];
        
        let x = cPos[idx];
        let y = cPos[idx+1];
        let z = cPos[idx+2];

        const speed = globalSpeed * 2.5; 
        
        x += (tx - x) * speed * delta;
        y += (ty - y) * speed * delta;
        z += (tz - z) * speed * delta;

        cPos[idx] = x;
        cPos[idx+1] = y;
        cPos[idx+2] = z;

        dummy.position.set(x,y,z);
        const rot = rotations[i];
        
        // Scale Logic
        let targetScale = 1.0;
        if (formation !== FormationType.TREE) {
             targetScale = 0.0;
        }

        let s = cScale[i];
        s += (targetScale - s) * speed * delta;
        cScale[i] = s;

        // Apply final scale
        const finalS = 0.15 * rot.scaleVar * ornamentScale * s;
        dummy.scale.setScalar(finalS);
        dummy.rotateOnAxis(rot.axis, delta * rot.speed);

        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, new THREE.Color(tCol[idx], tCol[idx+1], tCol[idx+2]));
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    // Explicitly hide when not in Tree formation
    <group ref={groupRef} visible={formation === FormationType.TREE}>
        <instancedMesh ref={meshRef} args={[undefined, undefined, ornamentCount]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial 
                metalness={0.9} 
                roughness={0.1} 
                emissiveIntensity={0.2}
            />
        </instancedMesh>
    </group>
  );
};
