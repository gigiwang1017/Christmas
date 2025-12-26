
import * as THREE from 'three';
import React from 'react';
import { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {
      [elemName: string]: any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {
        [elemName: string]: any;
      }
    }
  }
}

export enum AppState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED',
}

export enum FormationType {
  TREE = 'TREE',
  PINK_TREE = 'PINK_TREE',
  RED_TREE = 'RED_TREE',
  HAT = 'HAT',
  STOCKING = 'STOCKING',
  TEXT = 'TEXT',
  ELK = 'ELK',
  SANTA = 'SANTA',
  ANKERMAKER = 'ANKERMAKER',
  ANKER = 'ANKER',
  SOUNDCORE = 'SOUNDCORE',
  EUFY = 'EUFY',
  GIFT = 'GIFT',
}

export type OrnamentType = 'heavy' | 'medium' | 'light';
export type TopperType = 'hat' | 'star';
export type RepulsionType = 'gaussian' | 'splash' | 'linear';

export interface TreeConfig {
  height: number;
  radius: number;
  spirals: number; 
  spiralTightness: number; 
  xOffset: number; 
  yOffset: number; 
  densityBias?: number; 
}

export interface TopperConfig {
  type: TopperType;
  scale: number;
}

export interface ParticleConfig {
  count: number;
  size: number;
  speed: number;
  rotationSpeed: number; 
  repulsionStrength: number;
  repulsionRadius: number;
  repulsionType: RepulsionType;
  brightness: number; 
}

export interface RibbonConfig {
  radiusMult: number; 
  turns: number;      
  width: number;      
  particleCount: number;
  particleSize: number;
  spinSpeed: number;
  trailLength: number; 
  trailSpread: number; 
  ornamentCount: number; 
  ornamentScale: number; 
  brightness: number; 
}

export interface RibbonConfettiConfig {
  count: number;
  size: number;
  spread: number; 
  speed: number;
  randomness: number; 
}

export interface SnowConfig {
  count: number;
  size: number;
  speed: number;
  opacity: number;
}

export interface ColorConfig {
  emerald: string;
  gold: string;
  red: string;
  text: string;
  ankermaker: string;
  anker: string;
  soundcore: string;
  eufy: string;
}

export interface CycleConfig {
  formedDuration: number; 
  chaosDuration: number;  
}

export interface AppConfig {
  formation: FormationType; 
  tree: TreeConfig;
  topper: TopperConfig; 
  particles: ParticleConfig;
  ribbon: RibbonConfig;
  ribbonConfetti: RibbonConfettiConfig;
  snow: SnowConfig; 
  colors: ColorConfig;
  cycle: CycleConfig; 
  backgroundIntensity: number; 
  backgroundOpacity: number;
  backgroundScale: number;
  bloomIntensity: number; 
  ornamentScale: number; 
  exposure: number;
  formationScales: Record<FormationType, number>;
  formationExposures: Record<FormationType, number>;
  backgroundType: 'GALAXY' | 'IMAGE' | 'BOKEH' | 'FESTIVE' | 'RAINBOW' | 'PRISM' | 'FESTIVE_VIBE';
  customBackgroundImage?: string;
  customLogos: Partial<Record<FormationType, string>>;
  backgroundEffectStrength: number;
}

export interface ParticleData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  color: THREE.Color;
  size: number;
  speed: number; 
  type: number; 
}

export interface OrnamentData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: OrnamentType;
  color: THREE.Color;
  scale: number;
}
