

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SnowConfig } from '../types';

interface SnowProps {
  config: SnowConfig;
}

const vertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform float uHeight;
  attribute float sizeRandom;
  attribute float xOffset;
  attribute float zOffset;
  attribute float speedRandom;
  
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // Falling animation
    // Modulo ensures wrap around
    float fallOffset = uTime * (1.0 + speedRandom);
    pos.y = mod(pos.y - fallOffset, uHeight) - (uHeight * 0.5);
    
    // Sway animation
    pos.x += sin(uTime * 0.5 + xOffset) * 0.5;
    pos.z += cos(uTime * 0.3 + zOffset) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    // Fix: Clamp distance and max size to avoid bloom artifacts
    float zDist = max(1.0, -mvPosition.z);
    float pSize = uSize * sizeRandom * (200.0 / zDist);
    gl_PointSize = min(60.0, pSize);
    gl_Position = projectionMatrix * mvPosition;
    
    // Fade out near top/bottom edges slightly to prevent popping
    float h = uHeight * 0.5;
    float edge = smoothstep(h - 5.0, h, abs(pos.y));
    vAlpha = 1.0 - edge;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // Soft snowflake
    float strength = 1.0 - (dist * 2.0);
    strength = pow(strength, 1.5);
    
    gl_FragColor = vec4(uColor, strength * uOpacity * vAlpha);
  }
`;

export const Snow: React.FC<SnowProps> = ({ config }) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Define box volume for snow
  const range = 50; 
  const height = 60;

  const { positions, randoms } = useMemo(() => {
    const pos = new Float32Array(config.count * 3);
    const rnd = {
      size: new Float32Array(config.count),
      xOff: new Float32Array(config.count),
      zOff: new Float32Array(config.count),
      speed: new Float32Array(config.count)
    };

    for (let i = 0; i < config.count; i++) {
        // Random position in box
        pos[i * 3] = (Math.random() - 0.5) * range;
        pos[i * 3 + 1] = (Math.random() - 0.5) * height; 
        pos[i * 3 + 2] = (Math.random() - 0.5) * range;

        // Random attributes for variation
        rnd.size[i] = Math.random() * 0.5 + 0.5; // Scale multiplier
        rnd.xOff[i] = Math.random() * Math.PI * 2;
        rnd.zOff[i] = Math.random() * Math.PI * 2;
        rnd.speed[i] = Math.random(); // Varied fall speed
    }
    return { positions: pos, randoms: rnd };
  }, [config.count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSize: { value: config.size },
    uHeight: { value: height },
    uColor: { value: new THREE.Color('#ffffff') },
    uOpacity: { value: config.opacity }
  }), []);

  useFrame((state) => {
    if (pointsRef.current) {
        const material = pointsRef.current.material as THREE.ShaderMaterial;
        // Pass accumulated time + speed multiplier
        material.uniforms.uTime.value = state.clock.elapsedTime * config.speed;
        material.uniforms.uSize.value = config.size;
        material.uniforms.uOpacity.value = config.opacity;
    }
  });

  return (
    <points ref={pointsRef}>
        <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-sizeRandom" count={randoms.size.length} array={randoms.size} itemSize={1} />
            <bufferAttribute attach="attributes-xOffset" count={randoms.xOff.length} array={randoms.xOff} itemSize={1} />
            <bufferAttribute attach="attributes-zOffset" count={randoms.zOff.length} array={randoms.zOff} itemSize={1} />
            <bufferAttribute attach="attributes-speedRandom" count={randoms.speed.length} array={randoms.speed} itemSize={1} />
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
  )
}
