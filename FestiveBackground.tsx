
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface FestiveBackgroundProps {
  intensity: number;
  opacity: number;
  effectStrength: number;
  scale: number;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uEffectStrength;
  uniform float uScale;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    uv.x *= aspect;

    float time = uTime * uEffectStrength;

    // 1. Dynamic Nordic Gradient (Aurora vibe)
    vec3 colA = vec3(0.0, 0.05, 0.1); // Deep Night Blue
    vec3 colB = vec3(0.01, 0.1, 0.05); // Aurora Greenish
    vec3 colC = vec3(0.1, 0.0, 0.02); // Warm Festive Red
    
    float wave = sin(uv.x * 2.0 + time * 0.5) * 0.5 + 0.5;
    vec3 base = mix(colA, colB, wave);
    base = mix(base, colC, sin(uv.y * 3.0 - time * 0.3) * 0.3);

    vec3 finalColor = base * uIntensity;

    // 2. Center Soft Glow (Subject highlighting)
    float centerDist = length(vUv - 0.5);
    float glow = exp(-centerDist * 4.0);
    finalColor += vec3(0.1, 0.08, 0.05) * glow * uIntensity;

    // 3. Falling Geometric "Snow Crystals"
    for(float i = 0.0; i < 30.0; i++) {
        float h = hash(i * 777.7);
        float speed = 0.1 + h * 0.2;
        float x = hash(i * 123.4) * aspect;
        float y = mod(hash(i * 567.8) - time * speed, 1.2) - 0.1;
        
        vec2 p = vec2(x, y);
        float d = length(uv - p);
        
        // Crystal Shape (sharp flicker)
        float size = (0.005 + h * 0.015) * uScale;
        float twinkle = sin(time * 2.0 + h * 10.0) * 0.5 + 0.5;
        float crystal = smoothstep(size, 0.0, d);
        
        // Add star points for larger ones
        if(h > 0.7) {
            float cross = 0.001 / abs(uv.x - p.x) * max(0.0, 1.0 - abs(uv.y - p.y) / (size * 8.0));
            cross += 0.001 / abs(uv.y - p.y) * max(0.0, 1.0 - abs(uv.x - p.x) / (size * 8.0));
            crystal += cross * twinkle;
        }

        finalColor += vec3(0.8, 0.9, 1.0) * crystal * twinkle * uIntensity * uOpacity;
    }

    // 4. Subtle Vignette
    float vig = smoothstep(1.5, 0.5, centerDist * 2.2);
    finalColor *= vig;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export const FestiveBackground: React.FC<FestiveBackgroundProps> = ({ intensity, opacity, effectStrength, scale }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uOpacity: { value: opacity },
    uEffectStrength: { value: effectStrength },
    uScale: { value: scale },
    uResolution: { value: new THREE.Vector2(size.width, size.height) }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
      materialRef.current.uniforms.uIntensity.value = intensity;
      materialRef.current.uniforms.uOpacity.value = opacity;
      materialRef.current.uniforms.uEffectStrength.value = effectStrength;
      materialRef.current.uniforms.uScale.value = scale;
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={-100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};
