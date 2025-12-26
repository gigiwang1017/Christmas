
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface VibeBackgroundProps {
  intensity: number;
  opacity: number;
  effectStrength: number;
  scale: number;
}

const ELEMENT_COUNT = 60;

export const VibeBackground: React.FC<VibeBackgroundProps> = ({ intensity, opacity, effectStrength, scale }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const { viewport } = useThree();

  const elements = useMemo(() => {
    return Array.from({ length: ELEMENT_COUNT }).map((_, i) => {
      // Type 0: Snowball (White Sphere), 1: Bell (Gold Cone), 2: Gift/Sock (Red Box), 3: Elk-ish (Brown stylized)
      const type = Math.floor(Math.random() * 4);
      return {
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 40,
          -20 - Math.random() * 15
        ),
        speed: 0.1 + Math.random() * 0.4,
        amp: 2.0 + Math.random() * 3.0,
        rotSpeed: (Math.random() - 0.5) * 1.8,
        phase: Math.random() * Math.PI * 2,
        type,
        color: [
          new THREE.Color('#ffffff'), // White
          new THREE.Color('#fbe774'), // Gold
          new THREE.Color('#e51010'), // Red
          new THREE.Color('#5d4037'), // Brown
        ][type],
        size: 0.3 + Math.random() * 0.5
      };
    });
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime * effectStrength;

    elements.forEach((el, i) => {
      // Back and forth random floating physics
      const x = el.pos.x + Math.sin(time * el.speed + el.phase) * el.amp;
      const y = el.pos.y + Math.cos(time * el.speed * 0.7 + el.phase) * el.amp * 0.8;
      const z = el.pos.z + Math.sin(time * 0.3 + el.phase) * 1.5;
      
      dummy.position.set(x, y, z);
      dummy.rotation.set(
          time * el.rotSpeed,
          time * el.rotSpeed * 0.8,
          time * el.rotSpeed * 1.2
      );
      
      // Pulse scale slightly
      const s = el.size * scale * (1.0 + Math.sin(time * 1.2 + el.phase) * 0.15);
      
      // Differentiate geometry scale per type if using a single instanced mesh
      // Here we just use overall scale but we could vary it
      dummy.scale.setScalar(s);
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, el.color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group frustumCulled={false}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, ELEMENT_COUNT]} renderOrder={-90}>
        {/* Stylized geometric catch-all for background elements */}
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          metalness={0.6} 
          roughness={0.3} 
          transparent 
          opacity={opacity * 0.7} 
          emissiveIntensity={0.3}
          envMapIntensity={1.0}
        />
      </instancedMesh>
      <ambientLight intensity={0.4} />
    </group>
  );
};
