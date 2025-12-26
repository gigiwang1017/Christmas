
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// Import to ensure global JSX augmentation from types.ts is recognized
import { AppState } from '../types';

interface StarTopperProps {
  position: [number, number, number];
  scale?: number;
}

export const StarTopper: React.FC<StarTopperProps> = ({ position, scale = 1.0 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  // Generate a classic 5-pointed star shape
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.0;
    const innerRadius = 0.45; // Classic ratio for a sharp Christmas star

    for (let i = 0; i < points * 2; i++) {
      // Start from top (PI/2)
      const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
      const r = (i % 2 === 0) ? outerRadius : innerRadius;
      
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const extrudeSettings = {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center(); // Ensure it rotates around its center
    return geom;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
      // Continuous rotation
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
    if (coreRef.current) {
        // Core pulse
        const s = 1.0 + Math.sin(state.clock.elapsedTime * 4.0) * 0.1;
        coreRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Main Gold Star */}
      <mesh geometry={starGeometry}>
        <meshStandardMaterial 
          color="#FFD700" 
          emissive="#FFCC00"
          emissiveIntensity={2.0} // Strong glow for bloom
          roughness={0.2}
          metalness={1.0}
        />
      </mesh>

      {/* Inner "White Hot" Core for maximum bloom center */}
      <mesh ref={coreRef} position={[0, 0, 0]}>
         <sphereGeometry args={[0.3, 16, 16]} />
         <meshBasicMaterial color="#FFFFFF" transparent opacity={0.9} />
      </mesh>

      {/* Light source attached to star */}
      <pointLight intensity={3.0} color="#FFD700" distance={8} decay={2} />
    </group>
  );
};
