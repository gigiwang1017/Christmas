import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { Controls } from './components/Controls';
import { GestureController } from './components/GestureController';
import { AppState, AppConfig, FormationType } from './types';
import { BRAND_LOGOS } from './constants/assets';
import * as THREE from 'three';

const BASE_PARTICLE_COUNT = 70000;

const DEFAULT_SCALES: Record<FormationType, number> = {
  [FormationType.TREE]: 1.0,
  [FormationType.PINK_TREE]: 1.0,
  [FormationType.RED_TREE]: 1.0,
  [FormationType.HAT]: 1.65,
  [FormationType.STOCKING]: 1.65,
  [FormationType.TEXT]: 0.9,
  [FormationType.ELK]: 1.65,
  [FormationType.SANTA]: 1.0,
  [FormationType.ANKERMAKER]: 0.9,
  [FormationType.ANKER]: 1.15,
  [FormationType.SOUNDCORE]: 1.55,
  [FormationType.EUFY]: 0.9,
  [FormationType.GIFT]: 1.65,
};

const DEFAULT_EXPOSURES: Record<FormationType, number> = {
  [FormationType.TREE]: 1.0,
  [FormationType.PINK_TREE]: 1.0,
  [FormationType.RED_TREE]: 1.0,
  [FormationType.HAT]: 1.0,
  [FormationType.STOCKING]: 1.0,
  [FormationType.TEXT]: 1.0,
  [FormationType.ELK]: 1.0,
  [FormationType.SANTA]: 1.0,
  [FormationType.ANKERMAKER]: 1.0,
  [FormationType.ANKER]: 1.0,
  [FormationType.SOUNDCORE]: 1.0,
  [FormationType.EUFY]: 1.0,
  [FormationType.GIFT]: 1.0,
};

const DEFAULT_CONFIG: AppConfig = {
  formation: FormationType.TREE, 
  tree: {
    height: 12,
    radius: 4.5,
    spirals: 3, 
    spiralTightness: 0, 
    xOffset: 0,
    yOffset: 0,
    densityBias: 0.5, 
  },
  topper: {
    type: 'star',
    scale: 0.4, 
  },
  particles: {
    count: BASE_PARTICLE_COUNT, 
    size: 0.7,    
    speed: 4.1895, 
    rotationSpeed: 0.3,
    repulsionStrength: 5.0,
    repulsionRadius: 4.0,
    repulsionType: 'splash',
    brightness: 2.0, 
  },
  ribbon: {
    radiusMult: 1.1904,
    turns: 7.5,
    width: 0.5,
    particleCount: 4700,
    particleSize: 0.25, 
    spinSpeed: 1.0, 
    trailLength: 30,
    trailSpread: 0.11362,
    ornamentCount: 100, 
    ornamentScale: 0.9, 
    brightness: 4.3953, 
  },
  ribbonConfetti: {
    count: 5000, 
    size: 5,
    spread: 1.8069,
    speed: 1.0,
    randomness: 0.959, 
  },
  snow: {
    count: 2000,
    size: 0.5,
    speed: 1.5602,
    opacity: 0.6,
  },
  colors: {
    emerald: '#0bf4aa',
    gold: '#fbe774', 
    red: '#e51010',
    text: '#eed858',
    ankermaker: '#00c6ff', 
    anker: '#00c6ff',
    soundcore: '#12a7d9',
    eufy: '#17a6ee',
  },
  cycle: {
    formedDuration: 5.0, 
    chaosDuration: 3.0,  
  },
  backgroundIntensity: 0.5, 
  backgroundOpacity: 0.5, 
  backgroundScale: 0.8, 
  backgroundType: 'BOKEH',
  backgroundEffectStrength: 1.0,
  bloomIntensity: 0.4, 
  ornamentScale: 0.5, 
  exposure: 1.0, 
  formationScales: { ...DEFAULT_SCALES },
  formationExposures: { ...DEFAULT_EXPOSURES },
  // 确保访问 BRAND_LOGOS 属性时的鲁棒性
  customLogos: {
    [FormationType.ANKER]: (BRAND_LOGOS as any)?.ANKER || '',
    [FormationType.SOUNDCORE]: (BRAND_LOGOS as any)?.SOUNDCORE || '',
    [FormationType.EUFY]: (BRAND_LOGOS as any)?.EUFY || ''
  }, 
};

const ORDERED_FORMATIONS = [
  FormationType.TREE,
  FormationType.GIFT,
  FormationType.HAT,
  FormationType.STOCKING,
  FormationType.ELK,
  FormationType.SANTA,
  FormationType.RED_TREE,
  FormationType.PINK_TREE,
  FormationType.ANKERMAKER, 
  FormationType.TEXT,
  FormationType.ANKER,
  FormationType.SOUNDCORE,
  FormationType.EUFY,
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.CHAOS);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);
  const [isAutoCycle, setIsAutoCycle] = useState(true); 
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [selectedFormations, setSelectedFormations] = useState<FormationType[]>(ORDERED_FORMATIONS);

  const toggleState = () => {
    setAppState((prev) => (prev === AppState.CHAOS ? AppState.FORMED : AppState.CHAOS));
  };

  const isFormed = appState === AppState.FORMED;

  const dragInfo = useRef({ active: false, startX: 0, startY: 0 });
  const dragDelta = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureState = useRef({ rotationY: 0, rotationX: 0, zoomDistance: 1.0, isZooming: false });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setIsUIVisible(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (e.button === 1) { 
      e.preventDefault();
      e.stopPropagation(); 
      dragInfo.current = { active: true, startX: e.clientX, startY: e.clientY };
      document.body.style.cursor = 'all-scroll'; 
      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', onWindowPointerUp);
    }
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    if (!dragInfo.current.active) return;
    const deltaX = e.clientX - dragInfo.current.startX;
    const deltaY = e.clientY - dragInfo.current.startY;
    dragDelta.current.x = deltaX * 0.02;
    dragDelta.current.y = -deltaY * 0.02;
  };
  
  const onWindowPointerUp = () => {
    if (dragInfo.current.active) {
      dragInfo.current.active = false;
      document.body.style.cursor = 'auto';
      const dx = dragDelta.current.x;
      const dy = dragDelta.current.y;
      setConfig(prev => ({
         ...prev,
         tree: { ...prev.tree, xOffset: prev.tree.xOffset + dx, yOffset: prev.tree.yOffset + dy }
      }));
      dragDelta.current = { x: 0, y: 0 };
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    }
  };

  const handleResetPosition = () => {
    dragDelta.current = { x: 0, y: 0 };
    setConfig(prev => ({ ...prev, tree: { ...prev.tree, xOffset: 0, yOffset: 0 } }));
  };

  const handleResetToDefaults = () => {
    setConfig({ 
      ...DEFAULT_CONFIG, 
      formationScales: { ...DEFAULT_SCALES },
      formationExposures: { ...DEFAULT_EXPOSURES } 
    });
    handleResetPosition();
    setAppState(AppState.CHAOS);
    setTimeout(() => { setAppState(AppState.FORMED); }, 100);
  };

  const handleFormationChange = (formation: FormationType) => {
    setAppState(AppState.CHAOS);
    const scale = config.formationScales[formation] || 1.0;
    const newCount = Math.floor(BASE_PARTICLE_COUNT * scale);
    setConfig(prev => ({ 
      ...prev, 
      formation, 
      particles: { ...prev.particles, count: newCount } 
    }));
    setTimeout(() => { setAppState(AppState.FORMED); }, 400);
  };

  const togglePlaylistInclusion = (e: React.MouseEvent, type: FormationType) => {
    e.stopPropagation();
    setSelectedFormations(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleSnap = useCallback(() => {
    setAppState(AppState.CHAOS);
    setTimeout(() => {
      setConfig((prev) => {
          const playlist = ORDERED_FORMATIONS.filter(f => selectedFormations.includes(f));
          if (playlist.length === 0) return prev;
          const idx = playlist.indexOf(prev.formation);
          const nextIdx = (idx + 1) % playlist.length;
          const nextFormation = playlist[nextIdx];
          const nextScale = prev.formationScales[nextFormation] || 1.0;
          const nextCount = Math.floor(BASE_PARTICLE_COUNT * nextScale);
          return { 
            ...prev, 
            formation: nextFormation, 
            particles: { ...prev.particles, count: nextCount } 
          };
      });
      setAppState(AppState.FORMED);
    }, 400);
  }, [selectedFormations]);

  const handleNavigate = (dx: number, dy: number, mode: 'ROTATE' | 'ZOOM') => {
     if (mode === 'ROTATE') {
       gestureState.current.rotationY += dx * 5.0;
     } else if (mode === 'ZOOM') {
       const newZoom = gestureState.current.zoomDistance + dy;
       gestureState.current.zoomDistance = THREE.MathUtils.clamp(newZoom, 0.4, 2.5);
     }
  };

  useEffect(() => {
    if (!isAutoCycle || selectedFormations.length === 0) return;
    const delay = appState === AppState.FORMED ? config.cycle.formedDuration * 1000 : config.cycle.chaosDuration * 1000;
    const timer = setTimeout(() => {
      if (appState === AppState.FORMED) {
        setAppState(AppState.CHAOS);
      } else {
        setConfig((prevConfig) => {
          const playlist = ORDERED_FORMATIONS.filter(f => selectedFormations.includes(f));
          if (playlist.length === 0) return prevConfig;
          const currentIdxInPlaylist = playlist.indexOf(prevConfig.formation);
          const nextIdx = (currentIdxInPlaylist + 1) % playlist.length;
          const nextFormation = playlist[nextIdx];
          const nextScale = prevConfig.formationScales[nextFormation] || 1.0;
          const nextCount = Math.floor(BASE_PARTICLE_COUNT * nextScale);
          return { 
            ...prevConfig, 
            formation: nextFormation, 
            particles: { ...prevConfig.particles, count: nextCount } 
          };
        });
        setAppState(AppState.FORMED);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [isAutoCycle, selectedFormations, appState, config.cycle.formedDuration, config.cycle.chaosDuration]);

  const currentFormationScale = config.formationScales[config.formation];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" onPointerDownCapture={handlePointerDownCapture}>
      {/* Top Right Control Bar */}
      <div className={`absolute top-6 right-6 z-[200] pointer-events-auto flex gap-4 transition-opacity duration-500 ${isUIVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={handleResetPosition} className="group flex items-center gap-3 px-5 py-2.5 bg-black/40 hover:bg-luxury-gold/10 border border-luxury-gold/30 hover:border-luxury-gold/60 transition-all duration-500 rounded-sm backdrop-blur-sm shadow-xl">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-luxury-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11V7m0 8v-4m0 0h-4m4 0h4m-7.143 7.143c-3.945 0-7.143-3.198-7.143-7.143s3.198-7.143 7.143-7.143 7.143 3.198 7.143 7.143-3.198 7.143-7.143 7.143z" /></svg>
           <span className="text-[10px] font-display font-bold text-luxury-gold tracking-[0.2em]">CENTER VIEW</span>
        </button>
        <button onClick={handleResetToDefaults} className="group flex items-center gap-3 px-5 py-2.5 bg-black/40 hover:bg-red-500/10 border border-luxury-gold/30 hover:border-red-500/50 transition-all duration-500 rounded-sm backdrop-blur-sm shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-luxury-gold group-hover:text-red-400 group-hover:rotate-180 transition-all duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span className="text-[10px] font-display font-bold text-luxury-gold tracking-[0.2em]">RESET ALL</span>
        </button>
        <button onClick={() => setIsUIVisible(prev => !prev)} className="group flex items-center justify-center w-10 h-10 bg-black/40 hover:bg-luxury-gold/20 border border-luxury-gold/30 rounded-full backdrop-blur-sm shadow-xl">
          {isUIVisible ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-luxury-gold opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-luxury-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>}
        </button>
      </div>

      <Controls config={config} setConfig={setConfig} appState={appState} setAppState={setAppState} isUIVisible={isUIVisible} />
      
      <div className={`transition-opacity duration-1000 ${isUIVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed top-1/2 left-8 -translate-y-1/2 z-40 pointer-events-none flex flex-col gap-4">
            <div className="flex flex-col gap-3 bg-luxury-gold/5 backdrop-blur-3xl p-5 rounded-2xl border border-luxury-gold/10 shadow-2xl w-56 pointer-events-auto">
                <div className="flex flex-col mb-1">
                    <span className="text-luxury-gold/40 text-[8px] font-bold tracking-[0.3em] uppercase">{config.formation} Profile</span>
                    <h3 className="font-display font-bold text-xs text-luxury-gold tracking-[0.15em]">INDIVIDUAL SCALE</h3>
                </div>
                <div className="flex items-center gap-4">
                    <input type="range" min="0.5" max="2.5" step="0.05" value={currentFormationScale}
                        onChange={(e) => {
                            const newScale = parseFloat(e.target.value);
                            const newCount = Math.floor(BASE_PARTICLE_COUNT * newScale);
                            setConfig(prev => ({ 
                              ...prev, 
                              formationScales: { ...prev.formationScales, [prev.formation]: newScale },
                              particles: { ...prev.particles, count: newCount }
                            }));
                        }}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-luxury-gold" />
                    <span className="text-[10px] font-bold text-luxury-gold w-8 text-right font-serif">{currentFormationScale.toFixed(2)}x</span>
                </div>
            </div>
            <GestureController isEnabled={isGestureEnabled} setAppState={setAppState} appState={appState} onSnap={handleSnap} onNavigate={handleNavigate} gestureState={gestureState} />
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <Canvas shadows gl={{ antialias: false, alpha: false, stencil: false, depth: true }} dpr={[1, 1.5]}>
          <color attach="background" args={['#000504']} />
          <Scene state={appState} config={config} dragDelta={dragDelta} gestureState={gestureState} />
        </Canvas>
      </div>

      <div className={`absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-8 md:p-12 transition-all duration-1000 ${isUIVisible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
        <header className="text-center md:text-left pointer-events-none select-none z-20">
          <div className="inline-block relative">
            <span className="block text-luxury-gold/80 font-display text-xs md:text-sm tracking-[0.5em] uppercase mb-2 ml-1">Grand Luxury</span>
            <h1 className="font-display font-bold text-4xl md:text-6xl text-white tracking-widest drop-shadow-md leading-none">INTERACTIVE</h1>
            <h2 className="font-serif italic text-3xl md:text-5xl text-luxury-gold mt-1">Christmas Tree</h2>
          </div>
        </header>

        <footer className="w-full pointer-events-auto flex flex-col md:flex-row justify-between items-end gap-6 pb-20 md:pb-0">
          <div className="flex flex-col items-center md:items-start order-2 md:order-1 w-full md:w-auto relative">
             <div className="flex flex-wrap justify-center md:justify-start gap-2 max-w-lg">
                {ORDERED_FORMATIONS.map((type) => {
                  const isInPlaylist = selectedFormations.includes(type);
                  const isCurrent = config.formation === type;
                  return (
                    <button key={type} onClick={() => handleFormationChange(type)} 
                      className={`group flex items-center gap-3 px-4 py-2 text-[10px] md:text-xs tracking-wider font-serif border transition-all duration-500 rounded-sm ${isCurrent ? 'bg-luxury-gold text-black border-luxury-gold shadow-[0_0_20px_rgba(255,215,0,0.3)]' : 'bg-black/60 text-luxury-gold/80 border-luxury-gold/20 hover:border-luxury-gold/60'}`}>
                      <span onClick={(e) => togglePlaylistInclusion(e, type)} className={`w-4 h-4 flex items-center justify-center rounded-[2px] border transition-all duration-300 ${isInPlaylist ? 'bg-luxury-gold border-luxury-gold text-black' : 'bg-white/5 border-luxury-gold/40'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 ${isInPlaylist ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span className="font-bold">{type}</span>
                    </button>
                  );
                })}
             </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-4 order-1 md:order-2 w-full md:w-auto">
            <button onClick={toggleState} className={`group relative px-12 py-4 bg-transparent border border-luxury-gold transition-all duration-700 ease-out overflow-hidden ${isFormed ? 'bg-emerald-deep/80' : 'hover:bg-luxury-gold/10'}`}>
              <span className="relative z-10 font-display font-bold text-lg tracking-[0.2em] text-luxury-gold">{isFormed ? 'RELEASE CHAOS' : 'IGNITE FESTIVITY'}</span>
            </button>
            <div className="flex gap-3">
              <button onClick={() => setIsAutoCycle(prev => !prev)} className={`flex items-center gap-2 px-4 py-2 border rounded-full text-[10px] tracking-widest font-serif transition-all ${isAutoCycle ? 'border-luxury-gold bg-luxury-gold/20 text-luxury-gold' : 'border-white/20 text-white/50'}`}>
                <div className={`w-2 h-2 rounded-full ${isAutoCycle ? 'bg-luxury-gold animate-pulse' : 'bg-gray-500'}`} />
                {isAutoCycle ? 'AUTO CYCLE ON' : 'AUTO CYCLE OFF'}
              </button>
              <button onClick={() => {
                  setIsGestureEnabled(prev => {
                      const next = !prev;
                      if (next) setIsAutoCycle(false); 
                      return next;
                  });
              }} className={`flex items-center gap-2 px-4 py-2 border rounded-full text-[10px] tracking-widest font-serif transition-all ${isGestureEnabled ? 'border-emerald-500 bg-emerald-900/40 text-emerald-400' : 'border-white/20 text-white/50'}`}>
                <div className={`w-2 h-2 rounded-full ${isGestureEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                {isGestureEnabled ? 'GESTURE CONTROL ON' : 'ENABLE GESTURE CONTROL'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;