
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getRandomSpherePoint } from '../utils/math';
// Import to ensure global JSX augmentation from types.ts is recognized
import { AppState } from '../types';

interface GalaxyBackgroundProps {
  intensity: number;
}

const STAR_COUNT = 3000;
const RADIUS = 60;

const vertexShader = `
  attribute float size;
  attribute float speed;
  uniform float uTime;
  varying float vAlpha;
  
  void main() {
    vec3 pos = position;
    // Slow rotation of the entire galaxy handled in CPU or here
    // Let's add slight wave motion
    pos.y += sin(uTime * speed + pos.x * 0.1) * 0.2;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Twinkle effect based on time
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 * speed + pos.x);
    vAlpha = twinkle;
    
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    float strength = 1.0 - (dist * 2.0);
    strength = pow(strength, 2.0);
    
    gl_FragColor = vec4(uColor, strength * vAlpha * uIntensity);
  }
`;

export const GalaxyBackground: React.FC<GalaxyBackgroundProps> = ({ intensity }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, sizes, speeds } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const speeds = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const pos = getRandomSpherePoint(RADIUS);
      // Push them far away, ensure min distance
      const dist = pos.length();
      if (dist < 30) pos.setLength(30 + Math.random() * 30);
      
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      
      sizes[i] = Math.random() * 1.5 + 0.5;
      speeds[i] = Math.random() * 0.5 + 0.2;
    }
    
    return { positions, sizes, speeds };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#e0f7fa') }, // Cool silver/blueish white
    uIntensity: { value: intensity }
  }), [intensity]);

  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uIntensity.value = intensity;
      
      // Slow rotation of background
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={speeds.length} array={speeds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
