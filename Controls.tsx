
import React, { useEffect, useRef } from 'react';
import GUI from 'lil-gui'; 
import { AppConfig, AppState, FormationType, RepulsionType } from '../types';

interface ControlsProps {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  appState: AppState;
  setAppState: (state: AppState) => void;
  isUIVisible: boolean;
}

const BASE_PARTICLE_COUNT = 70000;

export const Controls: React.FC<ControlsProps> = ({ config, setConfig, appState, setAppState, isUIVisible }) => {
  const guiRef = useRef<GUI | null>(null);
  const isClosedRef = useRef<boolean>(true); 
  const configRef = useRef(config); 

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (guiRef.current) {
      // @ts-ignore
      isClosedRef.current = guiRef.current._closed;
      guiRef.current.destroy();
    }

    const gui = new GUI({ title: 'Tree Settings / 圣诞树设置' });
    guiRef.current = gui;

    if (isClosedRef.current) {
      gui.close();
    }

    gui.domElement.style.display = isUIVisible ? 'block' : 'none';
    gui.domElement.style.maxHeight = '70vh';
    gui.domElement.style.overflowY = 'auto';
    gui.domElement.classList.add('custom-gui-scroll');

    const params = {
      toggleState: () => setAppState(appState === AppState.CHAOS ? AppState.FORMED : AppState.CHAOS),
      formation: config.formation,
      currentFormationScale: config.formationScales[config.formation] || 1.0,
      currentFormationExposure: config.formationExposures[config.formation] || 1.0,
      
      height: config.tree.height,
      radius: config.tree.radius,
      spirals: config.tree.spirals,
      spiralTightness: config.tree.spiralTightness,
      xOffset: config.tree.xOffset,
      yOffset: config.tree.yOffset,
      densityBias: config.tree.densityBias || 1.0,
      
      topperType: config.topper.type,
      topperScale: config.topper.scale,

      ribbonRadiusMult: config.ribbon.radiusMult,
      ribbonTurns: config.ribbon.turns,
      ribbonWidth: config.ribbon.width,
      ribbonPCount: config.ribbon.particleCount,
      ribbonPSize: config.ribbon.particleSize,
      ribbonSpin: config.ribbon.spinSpeed,
      ribbonTrailLen: config.ribbon.trailLength,
      ribbonTrailSpr: config.ribbon.trailSpread,
      ribbonBrightness: config.ribbon.brightness,
      ribbonOrnCount: config.ribbon.ornamentCount,
      ribbonOrnScale: config.ribbon.ornamentScale,

      confettiCount: config.ribbonConfetti.count,
      confettiSize: config.ribbonConfetti.size,
      confettiSpread: config.ribbonConfetti.spread,
      confettiSpeed: config.ribbonConfetti.speed,
      confettiRandom: config.ribbonConfetti.randomness,

      particleCount: config.particles.count,
      particleSize: config.particles.size,
      particleSpeed: config.particles.speed,
      particleRotation: config.particles.rotationSpeed,
      repulsionStrength: config.particles.repulsionStrength,
      repulsionRadius: config.particles.repulsionRadius,
      repulsionType: config.particles.repulsionType,
      particleBrightness: config.particles.brightness,

      snowCount: config.snow.count,
      snowSize: config.snow.size,
      snowSpeed: config.snow.speed,
      snowOpacity: config.snow.opacity,
      
      colorEmerald: config.colors.emerald,
      colorGold: config.colors.gold,
      colorRed: config.colors.red,
      colorText: config.colors.text,
      colorAnkermaker: config.colors.ankermaker,
      colorAnker: config.colors.anker,
      colorSoundcore: config.colors.soundcore,
      colorEufy: config.colors.eufy,

      formedDuration: config.cycle.formedDuration,
      chaosDuration: config.cycle.chaosDuration,

      backgroundIntensity: config.backgroundIntensity,
      backgroundOpacity: config.backgroundOpacity,
      backgroundScale: config.backgroundScale,
      backgroundType: config.backgroundType,
      backgroundEffectStrength: config.backgroundEffectStrength,
      uploadBackground: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              setConfig(prev => ({ 
                ...prev, 
                customBackgroundImage: re.target?.result as string,
                backgroundType: 'IMAGE'
              }));
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      },
      uploadLogo: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              const currentFormation = config.formation;
              setConfig(prev => ({ 
                ...prev, 
                customLogos: {
                  ...prev.customLogos,
                  [currentFormation]: re.target?.result as string
                }
              }));
              setAppState(AppState.FORMED);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      },
      clearLogo: () => {
        const currentFormation = config.formation;
        setConfig(prev => {
          const nextLogos = { ...prev.customLogos };
          delete nextLogos[currentFormation];
          return { ...prev, customLogos: nextLogos };
        });
      },
      bloomIntensity: config.bloomIntensity,
      ornamentScale: config.ornamentScale,
      exposure: config.exposure,
    };

    const generalFolder = gui.addFolder('General / 通用');
    generalFolder.add(params, 'toggleState').name(appState === AppState.CHAOS ? 'Assemble (聚合)' : 'Explode (散开)');
    
    generalFolder.add(params, 'formation', [
      FormationType.TREE,
      FormationType.PINK_TREE,
      FormationType.RED_TREE,
      FormationType.GIFT,
      FormationType.HAT,
      FormationType.STOCKING,
      FormationType.ELK,
      FormationType.SANTA,
      FormationType.TEXT,
      FormationType.ANKERMAKER,
      FormationType.ANKER,
      FormationType.SOUNDCORE,
      FormationType.EUFY,
    ]).name('Formation (形态)').onChange((v: FormationType) => {
       const scale = config.formationScales[v] || 1.0;
       const newCount = Math.floor(BASE_PARTICLE_COUNT * scale);
       setConfig(prev => ({ 
         ...prev, 
         formation: v,
         particles: { ...prev.particles, count: newCount }
       }));
       if (appState === AppState.CHAOS) {
         setAppState(AppState.FORMED);
       }
    });

    generalFolder.add(params, 'currentFormationScale', 0.5, 2.5).name('Scale (形态比例)').onChange((v: number) => {
        const newCount = Math.floor(BASE_PARTICLE_COUNT * v);
        setConfig(prev => ({
            ...prev,
            formationScales: { ...prev.formationScales, [prev.formation]: v },
            particles: { ...prev.particles, count: newCount }
        }));
    });

    generalFolder.add(params, 'currentFormationExposure', 0.1, 3.0).name('Exposure (形态曝光)').onChange((v: number) => {
        setConfig(prev => ({
            ...prev,
            formationExposures: { ...prev.formationExposures, [prev.formation]: v }
        }));
    });

    const cycleFolder = gui.addFolder('Auto Cycle / 自动轮播');
    cycleFolder.add(params, 'formedDuration', 1, 60).name('Formed (停留时长 s)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, cycle: { ...prev.cycle, formedDuration: v } }));
    });
    cycleFolder.add(params, 'chaosDuration', 0.5, 30).name('Chaos (变换时长 s)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, cycle: { ...prev.cycle, chaosDuration: v } }));
    });

    const isTextFormation = [FormationType.TEXT, FormationType.ANKERMAKER, FormationType.ANKER, FormationType.SOUNDCORE, FormationType.EUFY].includes(config.formation);
    const customShapeFolder = gui.addFolder('Custom Shape / 自定义形态');
    if (!isTextFormation) {
      customShapeFolder.add({ msg: "Switch to Text type to upload logo" }, 'msg').name('Note').disable();
    } else {
      customShapeFolder.add(params, 'uploadLogo').name(`Upload for ${config.formation}`);
      customShapeFolder.add(params, 'clearLogo').name(`Clear ${config.formation} Logo`);
    }

    const backgroundFolder = gui.addFolder('Background / 背景');
    backgroundFolder.add(params, 'backgroundType', ['GALAXY', 'BOKEH', 'FESTIVE', 'RAINBOW', 'PRISM', 'FESTIVE_VIBE', 'IMAGE']).name('Type (类型)').onChange((v: any) => {
      setConfig(prev => ({ ...prev, backgroundType: v }));
    });
    backgroundFolder.add(params, 'backgroundIntensity', 0.0, 2.0).name('Intensity (强度)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, backgroundIntensity: v }));
    });
    backgroundFolder.add(params, 'backgroundOpacity', 0.0, 1.0).name('Opacity (透明度)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, backgroundOpacity: v }));
    });
    backgroundFolder.add(params, 'backgroundScale', 0.1, 3.0).name('Scale (背景比例)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, backgroundScale: v }));
    });
    backgroundFolder.add(params, 'backgroundEffectStrength', 0.0, 5.0).name('Dynamic Effect (动效)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, backgroundEffectStrength: v }));
    });
    backgroundFolder.add(params, 'uploadBackground').name('Upload Image (上传图)');

    const particleFolder = gui.addFolder('Particles / 粒子设置');
    particleFolder.add(params, 'particleCount', 5000, 150000, 1000).name('Count (数量)').onFinishChange((v: number) => {
      setConfig(prev => ({ ...prev, particles: { ...prev.particles, count: v } }));
    });
    particleFolder.add(params, 'particleSize', 0.1, 3.0).name('Size (大小)').onChange((v: number) => {
       setConfig(prev => ({ ...prev, particles: { ...prev.particles, size: v } }));
    });
    particleFolder.add(params, 'particleSpeed', 0.1, 5.0).name('Speed (速度)').onChange((v: number) => {
       setConfig(prev => ({ ...prev, particles: { ...prev.particles, speed: v } }));
    });
    particleFolder.add(params, 'particleRotation', 0.0, 3.0).name('Rot Speed (自转)').onChange((v: number) => {
       setConfig(prev => ({ ...prev, particles: { ...prev.particles, rotationSpeed: v } }));
    });
    particleFolder.add(params, 'repulsionStrength', 0.0, 20.0).name('Repulse (斥力)').onChange((v: number) => {
       setConfig(prev => ({ ...prev, particles: { ...prev.particles, repulsionStrength: v } }));
    });
    particleFolder.add(params, 'repulsionRadius', 0.0, 10.0).name('Radius (范围)').onChange((v: number) => {
       setConfig(prev => ({ ...prev, particles: { ...prev.particles, repulsionRadius: v } }));
    });

    const treeFolder = gui.addFolder('Tree / 树形态');
    treeFolder.add(params, 'height', 5, 20).name('Height (高度)').onFinishChange((v: number) => {
      setConfig(prev => ({ ...prev, tree: { ...prev.tree, height: v } }));
    });
    treeFolder.add(params, 'radius', 2, 8).name('Radius (半径)').onFinishChange((v: number) => {
      setConfig(prev => ({ ...prev, tree: { ...prev.tree, radius: v } }));
    });
    treeFolder.add(params, 'spirals', 0, 10, 1).name('Spirals (螺旋)').onFinishChange((v: number) => {
      setConfig(prev => ({ ...prev, tree: { ...prev.tree, spirals: v } }));
    });
    treeFolder.add(params, 'spiralTightness', 0.0, 1.0).name('Tightness (紧凑度)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, tree: { ...prev.tree, spiralTightness: v } }));
    });

    const ribbonFolder = gui.addFolder('Ribbon / 丝带');
    ribbonFolder.add(params, 'ribbonTurns', 1, 15, 0.5).name('Turns (圈数)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, ribbon: { ...prev.ribbon, turns: v } }));
    });
    ribbonFolder.add(params, 'ribbonWidth', 0.1, 1.5).name('Width (宽度)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, ribbon: { ...prev.ribbon, width: v } }));
    });
    ribbonFolder.add(params, 'ribbonSpin', 0.0, 5.0).name('Spin (转速)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, ribbon: { ...prev.ribbon, spinSpeed: v } }));
    });

    const visualFolder = gui.addFolder('Visual / 视觉');
    visualFolder.add(params, 'bloomIntensity', 0.0, 3.0).name('Glow (辉光)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, bloomIntensity: v }));
    });
    visualFolder.add(params, 'exposure', 0.1, 2.0).name('Global Exposure (全局曝光)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, exposure: v }));
    });
    visualFolder.add(params, 'ornamentScale', 0.1, 2.0).name('Decor Size (装饰)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, ornamentScale: v }));
    });

    const snowFolder = gui.addFolder('Snow / 雪花');
    snowFolder.add(params, 'snowCount', 0, 5000, 100).name('Count (数量)').onFinishChange((v: number) => {
      setConfig(prev => ({ ...prev, snow: { ...prev.snow, count: v } }));
    });
    snowFolder.add(params, 'snowOpacity', 0.0, 1.0).name('Opacity (不透明度)').onChange((v: number) => {
      setConfig(prev => ({ ...prev, snow: { ...prev.snow, opacity: v } }));
    });

    const colorFolder = gui.addFolder('Colors / 配色');
    colorFolder.addColor(params, 'colorEmerald').name('Emerald (主色)');
    colorFolder.addColor(params, 'colorGold').name('Secondary (辅色)');
    
    const textColorsFolder = colorFolder.addFolder('Text Formations / 文本配色');
    textColorsFolder.addColor(params, 'colorText').name('TEXT (圣诞快乐)').onChange((v: string) => {
      setConfig(prev => ({ ...prev, colors: { ...prev.colors, text: v } }));
    });
    textColorsFolder.addColor(params, 'colorAnkermaker').name('ANKERMAKER').onChange((v: string) => {
      setConfig(prev => ({ ...prev, colors: { ...prev.colors, ankermaker: v } }));
    });
    textColorsFolder.addColor(params, 'colorAnker').name('ANKER').onChange((v: string) => {
      setConfig(prev => ({ ...prev, colors: { ...prev.colors, anker: v } }));
    });
    textColorsFolder.addColor(params, 'colorSoundcore').name('SOUNDCORE').onChange((v: string) => {
      setConfig(prev => ({ ...prev, colors: { ...prev.colors, soundcore: v } }));
    });
    textColorsFolder.addColor(params, 'colorEufy').name('EUFY').onChange((v: string) => {
      setConfig(prev => ({ ...prev, colors: { ...prev.colors, eufy: v } }));
    });

    const guiEl = gui.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX; const startY = e.clientY;
        const rect = guiEl.getBoundingClientRect();
        const startLeft = rect.left; const startTop = rect.top;
        guiEl.style.right = 'auto'; guiEl.style.bottom = 'auto';
        guiEl.style.left = `${startLeft}px`; guiEl.style.top = `${startTop}px`;
        const onMouseMove = (me: MouseEvent) => {
          guiEl.style.left = `${startLeft + (me.clientX - startX)}px`;
          guiEl.style.top = `${startTop + (me.clientY - startY)}px`;
        };
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    };
    guiEl.addEventListener('mousedown', onMouseDown);

    return () => {
      if (guiRef.current) {
        // @ts-ignore
        isClosedRef.current = guiRef.current._closed;
      }
      guiEl.removeEventListener('mousedown', onMouseDown);
      gui.destroy();
    };
  }, [appState, isUIVisible, config.backgroundType, config.formation]); 

  return null;
};
