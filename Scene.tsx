
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera, OrbitControls, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MOUSE } from 'three';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { GalaxyBackground } from './GalaxyBackground';
import { CustomBackground } from './CustomBackground';
import { BokehBackground } from './BokehBackground';
import { FestiveBackground } from './FestiveBackground';
import { RainbowBackground } from './RainbowBackground';
import { PrismBackground } from './PrismBackground';
import { VibeBackground } from './VibeBackground';
import { SpiralRibbon } from './SpiralRibbon';
import { RibbonOrnaments } from './RibbonOrnaments';
import { RibbonConfetti } from './RibbonConfetti';
import { SantaHat } from './SantaHat';
import { StarTopper } from './StarTopper';
import { Snow } from './Snow';
import { AppState, AppConfig, FormationType } from '../types';

interface SceneProps {
  state: AppState;
  config: AppConfig;
  dragDelta: React.MutableRefObject<{ x: number; y: number }>;
  gestureState: React.MutableRefObject<{ 
    rotationY: number; 
    rotationX: number; 
    zoomDistance: number; 
    isZooming: boolean; 
  }>;
}

export const Scene: React.FC<SceneProps> = ({ state, config, dragDelta, gestureState }) => {
  const rotationGroupRef = useRef<THREE.Group>(null);
  const movementGroupRef = useRef<THREE.Group>(null);
  const autoRotRef = useRef<number>(0);
  const { gl } = useThree();

  const lastFormationRef = useRef<FormationType>(config.formation);
  const lastStateRef = useRef<AppState>(state);
  const isAlignedRef = useRef<boolean>(false);

  useEffect(() => {
    // 关键修复：将全局渲染曝光固定为 1.0
    // 防止形态曝光设置影响到背景渲染
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  const isTextType = useMemo(() => {
    return [
      FormationType.TEXT,
      FormationType.ANKERMAKER,
      FormationType.ANKER,
      FormationType.SOUNDCORE,
      FormationType.EUFY,
    ].includes(config.formation);
  }, [config.formation]);

  const isSantaType = config.formation === FormationType.SANTA;
  const isAlignableType = isTextType || isSantaType;

  const getPivotY = () => {
     switch (config.formation) {
       case FormationType.TREE: 
       case FormationType.PINK_TREE: 
       case FormationType.RED_TREE: return 6.0;
       case FormationType.HAT: return 2.5;
       case FormationType.STOCKING: return 2.5;
       case FormationType.GIFT: return 2.5;
       case FormationType.ELK: return 4.0;
       case FormationType.SANTA: return 5.0;
       default: return 5.5; 
     }
  };

  useFrame((_, delta) => {
    if (movementGroupRef.current) {
        movementGroupRef.current.position.x = config.tree.xOffset + dragDelta.current.x;
        movementGroupRef.current.position.y = config.tree.yOffset + dragDelta.current.y;
    }

    if (rotationGroupRef.current) {
      const isFormed = state === AppState.FORMED;
      const justFormed = lastStateRef.current === AppState.CHAOS && isFormed;
      const formationChanged = lastFormationRef.current !== config.formation;
      
      if (formationChanged || justFormed) {
        lastFormationRef.current = config.formation;
        lastStateRef.current = state;
        isAlignedRef.current = false;
        
        if (isAlignableType && isFormed) {
          const nearestCircle = Math.round(autoRotRef.current / (Math.PI * 2)) * (Math.PI * 2);
          if (isTextType) {
            autoRotRef.current = nearestCircle - Math.PI / 4; 
          } else if (isSantaType) {
            autoRotRef.current = nearestCircle;
          }
        }
      }

      if (isAlignableType && isFormed && !isAlignedRef.current) {
        const targetAutoRot = Math.round(autoRotRef.current / (Math.PI * 2)) * (Math.PI * 2);
        autoRotRef.current = THREE.MathUtils.lerp(autoRotRef.current, targetAutoRot, 0.08);
        
        if (Math.abs(autoRotRef.current - targetAutoRot) < 0.01) {
          autoRotRef.current = targetAutoRot;
          isAlignedRef.current = true;
        }
      } else {
        autoRotRef.current += delta * config.particles.rotationSpeed;
      }
      
      rotationGroupRef.current.rotation.y = autoRotRef.current - gestureState.current.rotationY;
      rotationGroupRef.current.rotation.x = gestureState.current.rotationX;
      
      const baseScale = config.formationScales[config.formation] ?? 1.0;
      const finalScale = baseScale * gestureState.current.zoomDistance;
      rotationGroupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), 0.1);
    }
  });

  const pivotY = getPivotY();
  const isAnyTree = [FormationType.TREE, FormationType.PINK_TREE, FormationType.RED_TREE].includes(config.formation);
  const topperY = config.tree.height - 1.2;

  const currentBloomIntensity = useMemo(() => {
    const isFormed = state === AppState.FORMED;
    let baseIntensity = config.bloomIntensity;
    
    if (isTextType) baseIntensity = 1.8;
    else if (config.formation === FormationType.SANTA) baseIntensity = 1.4;
    else if (config.formation === FormationType.RED_TREE) baseIntensity = 1.3;
    else if (config.formation === FormationType.GIFT) baseIntensity = 1.0;
    
    return isFormed ? baseIntensity * 1.25 : baseIntensity;
  }, [isTextType, config.formation, config.bloomIntensity, state]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 32]} fov={45} />
      <OrbitControls target={[0, 4.5, 0]} enablePan={false} minDistance={5} maxDistance={60} mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: undefined, RIGHT: MOUSE.PAN }} />
      
      <ambientLight intensity={0.25} color="#001a1a" />
      <spotLight position={[15, 25, 15]} intensity={state === AppState.FORMED ? 2000 : 1500} angle={0.4} penumbra={1} color="#fffcf0" castShadow />
      <pointLight position={[-10, 5, 5]} intensity={1000} color="#ff3300" />
      
      <Environment resolution={512}>
        <group rotation={[-Math.PI / 4, -0.3, 0]}>
          <Lightformer intensity={15} rotation-x={Math.PI / 2} position={[0, 10, -10]} scale={[20, 20, 1]} />
          <Lightformer form="ring" color="#FFD700" intensity={12} scale={15} position={[-20, 10, -20]} target={[0, 0, 0]} />
        </group>
      </Environment>

      {config.backgroundType === 'GALAXY' && <GalaxyBackground intensity={config.backgroundIntensity} />}
      {config.backgroundType === 'BOKEH' && <BokehBackground intensity={config.backgroundIntensity} opacity={config.backgroundOpacity} effectStrength={config.backgroundEffectStrength} scale={config.backgroundScale} />}
      {config.backgroundType === 'FESTIVE' && <FestiveBackground intensity={config.backgroundIntensity} opacity={config.backgroundOpacity} effectStrength={config.backgroundEffectStrength} scale={config.backgroundScale} />}
      {config.backgroundType === 'RAINBOW' && <RainbowBackground intensity={config.backgroundIntensity} opacity={config.backgroundOpacity} effectStrength={config.backgroundEffectStrength} scale={config.backgroundScale} />}
      {config.backgroundType === 'PRISM' && <PrismBackground intensity={config.backgroundIntensity} opacity={config.backgroundOpacity} effectStrength={config.backgroundEffectStrength} scale={config.backgroundScale} />}
      {config.backgroundType === 'FESTIVE_VIBE' && <VibeBackground intensity={config.backgroundIntensity} opacity={config.backgroundOpacity} effectStrength={config.backgroundEffectStrength} scale={config.backgroundScale} />}
      {config.backgroundType === 'IMAGE' && config.customBackgroundImage && (
        <CustomBackground 
          key={config.customBackgroundImage}
          imageUrl={config.customBackgroundImage} 
          intensity={config.backgroundIntensity} 
          effectStrength={config.backgroundEffectStrength}
        />
      )}

      <Snow config={config.snow} />

      <group ref={movementGroupRef}>
        <group position={[0, pivotY, 0]}>
            <group ref={rotationGroupRef}>
                 <group position={[0, isTextType ? 0 : -pivotY, 0]}>
                    <Foliage state={state} config={config} />
                    <Ornaments state={state} config={config} />
                    <SpiralRibbon state={state} config={config} />
                    <RibbonOrnaments state={state} config={config} />
                    <RibbonConfetti state={state} config={config} />
                    {isAnyTree && (
                      config.topper.type === 'hat' 
                        ? <SantaHat position={[0, topperY, 0]} scale={config.topper.scale} /> 
                        : <StarTopper position={[0, topperY, 0]} scale={config.topper.scale} />
                    )}
                 </group>
            </group>
        </group>
      </group>

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.7} intensity={currentBloomIntensity} radius={0.8} mipmapBlur />
        <Vignette offset={0.5} darkness={0.5} />
      </EffectComposer>
    </>
  );
};
