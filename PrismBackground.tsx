
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface PrismBackgroundProps {
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

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Simplex-ish noise for diverse random feel
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n = i.x + i.y*57.0;
    return mix(mix(hash(n+0.0), hash(n+1.0), f.x),
               mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 centeredUv = (uv - 0.5) / uScale;
    centeredUv.x *= aspect;

    float time = uTime * uEffectStrength * 0.12;
    
    // Multi-axis noise for "randomly switching" feel
    float noise1 = noise(centeredUv * 1.2 + vec2(time * 0.4, time * 0.2));
    float noise2 = noise(centeredUv * 2.8 - vec2(time * 0.3, time * 0.5));
    
    // Rotating linear projection with noise perturbations
    float angle = time * 0.25 + noise1 * 0.8;
    vec2 dir = vec2(cos(angle), sin(angle));
    float linePos = dot(centeredUv, dir) + noise2 * 0.3;
    
    // Dynamic Hue Shifting
    float hue = fract(linePos * 0.4 + time * 0.6 + noise1 * 0.15);
    
    // Saturation and Value dynamics for more diverse looks
    float sat = 0.5 + 0.3 * sin(time * 1.5 + noise1 * 4.0);
    float val = 0.8 + 0.2 * noise(centeredUv * 4.0 + time);
    
    vec3 color = hsv2rgb(vec3(hue, sat, val));
    
    // Add multiple shimmer highlights for extra sparkle
    float shimmer = pow(max(0.0, noise(centeredUv * 3.5 + time * 2.0)), 6.0) * 0.4;
    shimmer += pow(max(0.0, noise(centeredUv * 5.0 - time * 3.0)), 8.0) * 0.3;
    color += shimmer;

    vec3 finalColor = color * uIntensity;
    
    // Vignette for depth
    float vig = smoothstep(1.6, 0.4, length(centeredUv) * 0.85);
    finalColor *= vig;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export const PrismBackground: React.FC<PrismBackgroundProps> = ({ intensity, opacity, effectStrength, scale }) => {
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
