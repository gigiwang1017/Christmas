
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface BokehBackgroundProps {
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

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 drawBokehCircle(vec2 uv, vec2 pos, float radius, vec3 color, float alpha, float sharpness) {
    float d = length(uv - pos);
    float dR = length(uv - pos + vec2(0.003, 0.0) * uEffectStrength);
    float dB = length(uv - pos - vec2(0.003, 0.0) * uEffectStrength);
    
    float mask = smoothstep(radius, radius * sharpness, d);
    float maskR = smoothstep(radius, radius * sharpness, dR);
    float maskB = smoothstep(radius, radius * sharpness, dB);
    
    vec3 col = vec3(color.r * maskR, color.g * mask, color.b * maskB);
    float core = smoothstep(radius * 0.45, 0.0, d) * 0.6;
    return (col + core * color) * alpha;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    uv.x *= aspect;

    vec3 baseColA = vec3(0.002, 0.005, 0.02);
    vec3 baseColB = vec3(0.008, 0.015, 0.04);
    vec3 finalColor = mix(baseColA, baseColB, vUv.y) * uIntensity;

    // Use a baseline speed even if effectStrength is 0
    float dynamicTime = uTime * (0.1 + uEffectStrength * 0.4);

    for (float i = 0.0; i < 40.0; i++) {
        float h = hash(i * 91.23);
        
        // Fluid floating motion
        float speed = 0.2 + h * 0.8;
        vec2 pos = vec2(
            hash(i * 12.34) * aspect + sin(dynamicTime * speed + h * 6.28) * (0.15 + h * 0.2),
            hash(i * 56.78) + cos(dynamicTime * speed * 0.7 - h * 3.14) * (0.15 + h * 0.2)
        );
        
        // Breathing effect (Size) - influenced by uScale
        float breathe = sin(dynamicTime * (0.8 + h * 1.5) + h * 10.0) * 0.2 + 0.8;
        float radius = (0.02 + hash(i * 44.4) * 0.25) * breathe * uScale;
        
        // Twinkle (Brightness)
        float twinkle = pow(sin(dynamicTime * (1.2 + h * 2.0) + h * 20.0) * 0.5 + 0.5, 2.5);
        float alpha = (0.2 + 0.8 * twinkle) * uIntensity * uOpacity;
        
        // Dynamic Hue Rotation
        float hueBase = fract(h + dynamicTime * 0.02);
        vec3 color = hsv2rgb(vec3(hueBase, 0.7, 1.0));
        
        // Depth-based sharpness
        float sharpness = mix(0.3, 0.8, h);
        
        finalColor += drawBokehCircle(uv, pos, radius, color, alpha, sharpness);
    }

    float vignette = smoothstep(1.8, 0.4, length(vUv - 0.5) * 2.5);
    finalColor *= vignette;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

export const BokehBackground: React.FC<BokehBackgroundProps> = ({ intensity, opacity, effectStrength, scale }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uOpacity: { value: opacity },
    uEffectStrength: { value: effectStrength },
    uScale: { value: scale },
    uResolution: { value: new THREE.Vector2(size.width, size.height) }
  }), []); // Keep uniforms stable

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
