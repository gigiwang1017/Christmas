
import React, { useEffect, useRef, useState } from 'react';
import { AppState } from '../types';

declare global {
  interface Window {
    Hands: any;
  }
}

interface GestureControllerProps {
  isEnabled: boolean;
  setAppState: (state: AppState) => void;
  appState: AppState;
  onSnap: () => void;
  onNavigate: (dx: number, dy: number, mode: 'ROTATE' | 'ZOOM') => void;
  gestureState: React.MutableRefObject<{ 
    rotationY: number; 
    rotationX: number; 
    zoomDistance: number; 
    isZooming: boolean; 
  }>;
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

const GestureItem = ({ icon, label, action, active, progress }: { icon: string, label: string, action: string, active: boolean, progress?: number }) => (
  <div className={`relative flex items-center gap-3 transition-all duration-200 ${active ? 'opacity-100 scale-110 translate-x-2 text-white' : 'opacity-30 text-luxury-gold'}`}>
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${active ? 'bg-emerald-500/20 border border-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'bg-white/5 border border-white/10'}`}>
          <span className="text-lg">{icon}</span>
      </div>
      <div className="flex flex-col leading-tight z-10">
          <span className={`text-[10px] uppercase tracking-widest font-bold ${active ? 'text-emerald-300' : 'text-luxury-gold'}`}>
            {label}
          </span>
          <span className="text-[9px] text-white/60 font-serif italic">
            {action}
          </span>
      </div>
      {progress !== undefined && progress > 0 && progress < 100 && (
         <div className="absolute -bottom-1 left-0 h-0.5 bg-emerald-400/80 transition-all duration-75" style={{ width: `${progress}%` }} />
      )}
  </div>
);

export const GestureController: React.FC<GestureControllerProps> = ({ 
  isEnabled, 
  setAppState, 
  appState, 
  onSnap,
  onNavigate,
  gestureState
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rVFCIdRef = useRef<number | null>(null);
  const isInitializing = useRef(false);
  
  const [gesture, setGesture] = useState<string>('IDLE');
  const [holdProgress, setHoldProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const lastSwitchTime = useRef<number>(0);
  const isSwitchPrimed = useRef<boolean>(false);
  const prevIndexPos = useRef<{x: number, y: number} | null>(null);
  const poseHoldStart = useRef<number>(0);
  const currentPose = useRef<string>('NONE');
  const smoothedLandmarks = useRef<any[]>([]);

  const initialHandSize = useRef<number | null>(null);
  const initialZoom = useRef<number>(1.0);

  // --- 毫秒级极速响应参数 ---
  const EMA_ALPHA = 0.8; // 极速跟随系数，80% 权重给当前帧
  const CONFIDENCE_THRESHOLD = 2; // 连续 2 帧识别即可确认状态
  const poseCounters = useRef<Record<string, number>>({});
  const processingRef = useRef(false);

  const cleanup = () => {
    if (videoRef.current && 'cancelVideoFrameCallback' in videoRef.current && rVFCIdRef.current) {
        // @ts-ignore
        videoRef.current.cancelVideoFrameCallback(rVFCIdRef.current);
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (handsRef.current) {
        try { handsRef.current.close(); } catch(e){}
        handsRef.current = null;
    }
    setIsCameraActive(false);
    processingRef.current = false;
  };

  // 使用 requestVideoFrameCallback 替代常规 rAF
  // 这能显著减少视频采集与 AI 推理之间的延迟
  const processVideoFrame = async () => {
    if (!videoRef.current || !handsRef.current || !isEnabled) return;

    if (!processingRef.current && videoRef.current.readyState >= 2) {
      processingRef.current = true;
      try {
        await handsRef.current.send({ image: videoRef.current });
      } catch (e) {
        console.error("Inference Error:", e);
      }
      processingRef.current = false;
    }

    if ('requestVideoFrameCallback' in videoRef.current) {
      // @ts-ignore
      rVFCIdRef.current = videoRef.current.requestVideoFrameCallback(processVideoFrame);
    } else {
      // 兼容不支持 rVFC 的环境
      requestAnimationFrame(processVideoFrame);
    }
  };

  const initEngine = async () => {
    if (isInitializing.current || !window.Hands) return;
    isInitializing.current = true;
    setError(null);
    
    try {
        cleanup();
        const hands = new window.Hands({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
        });
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0, // 使用最轻量级模型 (0) 实现最快响应
            minDetectionConfidence: 0.5, // 降低门槛，更快发现手
            minTrackingConfidence: 0.8  // 增强追踪稳定性
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 320, 
                height: 240, 
                facingMode: "user",
                frameRate: { ideal: 60 } // 请求高帧率支持
            } 
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadeddata = () => {
                videoRef.current?.play().then(() => {
                    setIsCameraActive(true);
                    if ('requestVideoFrameCallback' in videoRef.current!) {
                        // @ts-ignore
                        rVFCIdRef.current = videoRef.current.requestVideoFrameCallback(processVideoFrame);
                    } else {
                        processVideoFrame();
                    }
                }).catch(() => setError('AUTOPLAY_BLOCKED'));
            };
        }
    } catch (e: any) {
        setError(e.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'HARDWARE_ERROR');
    } finally {
        isInitializing.current = false;
    }
  };

  useEffect(() => {
    if (isEnabled) initEngine();
    else cleanup();
    return cleanup;
  }, [isEnabled]);

  const onResults = (results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        setGesture('IDLE');
        prevIndexPos.current = null;
        initialHandSize.current = null;
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        return;
    }

    const rawLM = results.multiHandLandmarks[0];
    
    // 初始化或更新平滑点
    if (smoothedLandmarks.current.length === 0) {
        smoothedLandmarks.current = rawLM.map((p: any) => ({ ...p }));
    } else {
        for (let i = 0; i < rawLM.length; i++) {
            // 毫秒级极速 EMA 算法
            smoothedLandmarks.current[i].x += (rawLM[i].x - smoothedLandmarks.current[i].x) * EMA_ALPHA;
            smoothedLandmarks.current[i].y += (rawLM[i].y - smoothedLandmarks.current[i].y) * EMA_ALPHA;
        }
    }

    const lm = smoothedLandmarks.current;
    const wrist = lm[0];
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const middleTip = lm[12];
    const indexMCP = lm[5];
    const middleMCP = lm[9];
    
    // 基础计算
    const handSize = Math.hypot(wrist.x - middleMCP.x, wrist.y - middleMCP.y);
    const getExt = (idx: number) => Math.hypot(lm[idx].x - wrist.x, lm[idx].y - wrist.y) / (handSize || 1);
    
    const [tExt, iExt, mExt, rExt, pExt] = [getExt(4), getExt(8), getExt(12), getExt(16), getExt(20)];
    
    const EXT_TH = 1.3; 
    const CURL_TH = 1.0;
    const THUMB_EXT_TH = 1.1;

    let rawPose = 'IDLE';
    
    // 逻辑判定层
    if (iExt > EXT_TH && mExt < CURL_TH && rExt < CURL_TH && pExt < CURL_TH) {
        rawPose = 'ROTATE';
    } 
    else if (iExt > EXT_TH && mExt > EXT_TH && rExt < CURL_TH && pExt < CURL_TH) {
        rawPose = 'PEACE_ZOOM';
    }
    else if (tExt > THUMB_EXT_TH && iExt < CURL_TH && mExt < CURL_TH && rExt < CURL_TH && pExt < CURL_TH && thumbTip.y < lm[3].y) {
        rawPose = 'LIKE_SNAP';
    }
    else if (iExt < CURL_TH && mExt < CURL_TH && rExt < CURL_TH && pExt < CURL_TH) {
        rawPose = 'FIST';
    }
    else if (iExt > EXT_TH && mExt > EXT_TH && rExt > EXT_TH && pExt > EXT_TH) {
        rawPose = 'OPEN';
    }

    // 状态机加速确认
    let confirmedPose = 'IDLE';
    Object.keys(poseCounters.current).forEach(k => { 
        if(k !== rawPose) poseCounters.current[k] = Math.max(0, poseCounters.current[k] - 1);
    });
    poseCounters.current[rawPose] = (poseCounters.current[rawPose] || 0) + 1;
    
    if ((poseCounters.current[rawPose] || 0) >= CONFIDENCE_THRESHOLD) {
        confirmedPose = rawPose;
    }

    setGesture(confirmedPose);
    const now = Date.now();

    // --- 极速交互层 ---

    // 1. 旋转 (去除防抖抖动，使用高频位移)
    if (confirmedPose === 'ROTATE') {
        if (prevIndexPos.current) {
            const dx = indexTip.x - prevIndexPos.current.x;
            const dy = indexTip.y - prevIndexPos.current.y;
            // 过滤极微小位移 (Deadzone)
            if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
                onNavigate(dx, dy, 'ROTATE');
            }
        }
        prevIndexPos.current = { x: indexTip.x, y: indexTip.y };
    } else {
        prevIndexPos.current = null;
    }

    // 2. 缩放 (采用指数平滑推拉)
    if (confirmedPose === 'PEACE_ZOOM') {
        if (initialHandSize.current === null) {
            initialHandSize.current = handSize;
            initialZoom.current = gestureState.current.zoomDistance;
        } else {
            const ratio = handSize / (initialHandSize.current || 1);
            const targetZoom = initialZoom.current * Math.pow(ratio, 1.4);
            const zoomDelta = (targetZoom - gestureState.current.zoomDistance) * 0.35; 
            onNavigate(0, zoomDelta, 'ZOOM');
        }
    } else {
        initialHandSize.current = null;
    }

    // 3. 快速 Snap
    if (confirmedPose === 'LIKE_SNAP') {
        if (!isSwitchPrimed.current && (now - lastSwitchTime.current > 500)) {
            onSnap();
            lastSwitchTime.current = now;
            isSwitchPrimed.current = true;
        }
    } else {
        isSwitchPrimed.current = false;
    }

    // 4. 形成/散开 (响应时间压缩至 300ms)
    if (confirmedPose === 'FIST' || confirmedPose === 'OPEN') {
        if (currentPose.current === confirmedPose) {
            const dur = now - poseHoldStart.current;
            const progress = Math.min(100, (dur / 300) * 100);
            setHoldProgress(progress);
            if (dur > 300) {
                setAppState(confirmedPose === 'FIST' ? AppState.FORMED : AppState.CHAOS);
                poseHoldStart.current = now + 800; // 冷却期
            }
        } else {
            currentPose.current = confirmedPose;
            poseHoldStart.current = now;
            setHoldProgress(0);
        }
    } else {
        setHoldProgress(0);
        if (confirmedPose !== 'IDLE') currentPose.current = 'NONE';
    }

    // Canvas 渲染同步
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.save();
            ctx.translate(canvasRef.current.width, 0); ctx.scale(-1, 1);
            ctx.lineWidth = 3;
            ctx.strokeStyle = confirmedPose !== 'IDLE' ? '#34d399' : '#ffffff22';
            HAND_CONNECTIONS.forEach(([s, e]) => {
                ctx.beginPath();
                ctx.moveTo(lm[s].x * canvasRef.current!.width, lm[s].y * canvasRef.current!.height);
                ctx.lineTo(lm[e].x * canvasRef.current!.width, lm[e].y * canvasRef.current!.height);
                ctx.stroke();
            });
            ctx.restore();
        }
    }
  };

  if (!isEnabled) return null;

  return (
    <>
        <div className="flex flex-col gap-2">
            <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black w-56 h-40 shadow-2xl backdrop-blur-md pointer-events-auto">
                {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-950/40">
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Sensor Error</span>
                        <button onClick={() => initEngine()} className="px-6 py-2 mt-4 bg-luxury-gold/20 border border-luxury-gold/50 rounded-full text-[9px] text-luxury-gold font-bold tracking-widest">RETRY</button>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-20" playsInline muted autoPlay />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width="320" height="240" />
                        {!isCameraActive && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><div className="w-6 h-6 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin" /></div>}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md">
                            <div className={`w-1.5 h-1.5 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                            <span className="text-[8px] font-bold text-emerald-400 uppercase">Optical Sync Active</span>
                        </div>
                    </>
                )}
            </div>
            {!error && isCameraActive && (
                <div className="flex justify-start">
                    <div className={`px-4 py-1.5 rounded-full backdrop-blur-md border transition-all duration-500 ${gesture === 'IDLE' ? 'bg-black/60 border-white/10' : 'bg-emerald-900/60 border-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.3)]'}`}>
                       <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${gesture === 'IDLE' ? 'text-white/30' : 'text-emerald-300'}`}>{gesture.replace('_', ' ')}</span>
                    </div>
                </div>
            )}
        </div>

        <div className="flex flex-col gap-4 bg-black/40 backdrop-blur-3xl p-6 rounded-2xl border border-white/5 shadow-2xl w-56 pointer-events-none">
            <div className="flex flex-col mb-1">
                <span className="text-emerald-400 text-[8px] font-bold tracking-[0.3em] uppercase opacity-60">Gesture Profile</span>
                <h3 className="font-display font-bold text-xs text-luxury-gold tracking-[0.15em]">MS-LATENCY v5.0</h3>
            </div>
            <div className="space-y-3">
                <GestureItem icon="☝️" label="Point" action="360° Rotate" active={gesture === 'ROTATE'} />
                <GestureItem icon="👍" label="Thumbs Up" action="Switch Formation" active={gesture === 'LIKE_SNAP'} />
                <GestureItem icon="✌️" label="Peace Zoom" action="In / Out Depth" active={gesture === 'PEACE_ZOOM'} />
                <GestureItem icon="✊" label="Fist" action="Form Silky" active={gesture === 'FIST'} progress={currentPose.current === 'FIST' ? holdProgress : 0} />
                <GestureItem icon="🖐" label="Open" action="Release Chaos" active={gesture === 'OPEN'} progress={currentPose.current === 'OPEN' ? holdProgress : 0} />
            </div>
        </div>
    </>
  );
};
