
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface RainbowBackgroundProps {
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

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    
    // Center and scale
    vec2 centeredUv = (uv - 0.5) / uScale;
    centeredUv.x *= aspect;

    float time = uTime * uEffectStrength * 0.2;
    
    // Create a dynamic pattern for rainbow mixing
    float dist = length(centeredUv);
    float angle = atan(centeredUv.y, centeredUv.x);
    
    // Multi-color mixing
    float hue = fract(angle / 6.28 + dist * 0.5 - time);
    vec3 rainbow = hsv2rgb(vec3(hue, 0.6, 1.0));
    
    // Add some noise-like patterns
    float noise = sin(centeredUv.x * 2.0 + time) * cos(centeredUv.y * 2.0 - time);
    rainbow = mix(rainbow, hsv2rgb(vec3(fract(hue + 0.5), 0.5, 0.8)), noise * 0.2);

    vec3 finalColor = rainbow * uIntensity;
    
    // Vignette for depth
    float vig = smoothstep(1.5, 0.5, dist);
    finalColor *= vig;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export const RainbowBackground: React.FC<RainbowBackgroundProps> = ({ intensity, opacity, effectStrength, scale }) => {
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
