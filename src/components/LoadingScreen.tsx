import React, { useEffect, useState } from 'react';
import { Zap, Loader2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
  minDisplayTime?: number;
}

const tips = [
  'Convert HEIC images to JPEG in seconds',
  'Extract audio from any video file',
  'Supports 8+ audio formats',
  '100% offline processing - your privacy matters',
  'Batch convert multiple images at once',
  'PDF to Word conversion with AI technology'
];

function getRandomTip(): string {
  return tips[Math.floor(Math.random() * tips.length)];
}

export function LoadingScreen({ onLoadingComplete, minDisplayTime = 2500 }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [fadeOut, setFadeOut] = useState(false);
  const [currentTip, setCurrentTip] = useState(getRandomTip());

  useEffect(() => {
    const startTime = Date.now();
    
    // Simulate loading steps
    const steps = [
      { progress: 20, message: 'Warming up modules...', delay: 400 },
      { progress: 45, message: 'Preparing high-speed converters...', delay: 600 },
      { progress: 70, message: 'Securing processing vault...', delay: 800 },
      { progress: 90, message: 'Polishing interface...', delay: 1000 },
      { progress: 100, message: 'System Ready', delay: 400 },
    ];

    let currentStepIndex = 0;

    const runSteps = () => {
      if (currentStepIndex < steps.length) {
        const step = steps[currentStepIndex];
        setProgress(step.progress);
        setStatusMessage(step.message);
        currentStepIndex++;
        setTimeout(runSteps, step.delay);
      } else {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDisplayTime - elapsed);
        
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => {
            onLoadingComplete();
          }, 800);
        }, remaining);
      }
    };

    const timer = setTimeout(runSteps, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [minDisplayTime, onLoadingComplete]);

  // Tip carousel effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(getRandomTip());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#08080A] transition-opacity duration-700 ease-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-pink-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-sm px-8 text-center space-y-12">
        {/* Logo Section */}
        <motion.div 
           initial={{ scale: 0.9, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-accent-grad blur-2xl opacity-20 animate-pulse" />
            <div className="relative p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
              <Zap className="w-12 h-12 text-white" fill="currentColor" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">
              FormatForge
              <span className="ml-2 px-2 py-0.5 bg-accent-grad rounded text-[10px] not-italic font-bold align-middle">PRO</span>
            </h1>
          </div>
        </motion.div>

        {/* Progress System */}
        <div className="space-y-4">
          <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
             <motion.div 
                className="absolute inset-y-0 left-0 bg-accent-grad rounded-full shadow-[0_0_15px_rgba(192,132,252,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
             />
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">{statusMessage}</span>
            <span className="text-[10px] font-mono text-purple-400 font-bold">{progress}%</span>
          </div>
        </div>

        {/* Tips Section */}
        <div className="h-20 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentTip}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-left"
            >
              <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-text-dim leading-relaxed font-medium">
                {currentTip}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="space-y-4">
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" 
                style={{ animationDelay: `${i * 0.2}s` }} 
              />
            ))}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20">
            Made by ABDULLAH, HASSAAN and HAMAAD
          </p>
        </div>
      </div>
    </div>
  );
}
