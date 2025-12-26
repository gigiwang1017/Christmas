
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// Import to ensure global JSX augmentation from types.ts is recognized
import { AppState } from '../types';

interface SantaHatProps {
  position: [number, number, number];
  scale?: number;
}

export const SantaHat: React.FC<SantaHatProps> = ({ position, scale = 1.0 }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
        // Gentle bobbing
        groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
        // Gentle rotation
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
        groupRef.current.rotation.z = 0.1 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, 0, 0.1]} scale={scale}>
      {/* Brim */}
      <mesh position={[0, -0.2, 0]}>
        <torusGeometry args={[0.45, 0.15, 16, 32]} />
        <meshStandardMaterial 
          color="#ffffff" 
          emissive="#ffffff" 
          emissiveIntensity={0.6} 
          roughness={0.8}
        />
      </mesh>

      {/* Main Cone Hat */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.4, 1.4, 32]} />
        <meshStandardMaterial 
            color="#ff0000" 
            emissive="#d00000" 
            emissiveIntensity={0.8} 
            roughness={0.3}
            metalness={0.1}
        />
      </mesh>

      {/* Pompom */}
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial 
            color="#ffffff" 
            emissive="#ffffff" 
            emissiveIntensity={0.9} 
            roughness={0.8}
        />
      </mesh>
      
      {/* Glow Halo */}
      <pointLight position={[0, 0.5, 0]} intensity={2} color="#ff0000" distance={3} decay={2} />
    </group>
  );
};
