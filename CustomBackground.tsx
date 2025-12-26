
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CustomBackgroundProps {
  imageUrl: string;
  intensity: number;
  effectStrength: number;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uEffectStrength;
  uniform vec2 uResolution;
  uniform vec2 uTextureRes;
  varying vec2 vUv;

  void main() {
    vec2 ratio = vec2(
      min((uResolution.x / uResolution.y) / (uTextureRes.x / uTextureRes.y), 1.0),
      min((uResolution.y / uResolution.x) / (uTextureRes.y / uTextureRes.x), 1.0)
    );

    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    // Subtle liquid distortion
    float distortion = sin(uv.y * 10.0 + uTime * 0.5) * 0.002 * uEffectStrength;
    distortion += cos(uv.x * 8.0 + uTime * 0.3) * 0.002 * uEffectStrength;
    
    vec2 distortedUv = uv + vec2(distortion);
    
    vec4 tex = texture2D(uTexture, distortedUv);
    
    // Slight shimmer/breathing effect
    float shimmer = sin(uTime * 0.2) * 0.05 * uEffectStrength;
    tex.rgb *= (1.0 + shimmer);
    
    gl_FragColor = vec4(tex.rgb * uIntensity, 1.0);
  }
`;

export const CustomBackground: React.FC<CustomBackgroundProps> = ({ imageUrl, intensity, effectStrength }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load(imageUrl);
  }, [imageUrl]);

  // Clean up texture on unmount
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uEffectStrength: { value: effectStrength },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uTextureRes: { value: new THREE.Vector2(1, 1) }
  }), [texture, intensity, effectStrength, size]);

  useEffect(() => {
    if (texture.image) {
      uniforms.uTextureRes.value.set(texture.image.width, texture.image.height);
    } else {
      texture.onUpdate = () => {
        if (texture.image) {
          uniforms.uTextureRes.value.set(texture.image.width, texture.image.height);
        }
      };
    }
  }, [texture, uniforms]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  });

  return (
    <mesh renderOrder={-100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};
