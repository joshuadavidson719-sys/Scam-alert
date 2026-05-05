import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3({ image }: { image: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 overflow-hidden bg-black flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.15 }}
    >
      <motion.img
        src={image}
        alt="The Standoff"
        className="w-full h-full object-cover"
        initial={{ scale: 1.1, filter: 'contrast(1.2) saturate(1.2)' }}
        animate={{ 
          scale: 1, 
          filter: phase >= 2 ? 'contrast(1.5) saturate(0.8) brightness(0.7)' : 'contrast(1.2) saturate(1.2)'
        }}
        transition={{ duration: 4.5, ease: "circOut" }}
      />
      
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="absolute inset-0 flex flex-col items-center justify-between py-24 z-10 pointer-events-none">
        <motion.div
          className="h-[1px] bg-white/30 w-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        
        <div className="flex w-full justify-between px-24">
          <motion.div 
            className="w-48 h-2 bg-blue-500 rounded-full"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          />
          <motion.div 
            className="w-48 h-2 bg-red-500 rounded-full"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring' }}
          />
        </div>
        
        <motion.div
          className="h-[1px] bg-white/30 w-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </div>

      {phase >= 1 && (
        <motion.div
          className="absolute inset-0 border-[10px] border-red-600 z-20 pointer-events-none"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: [0, 1, 0.5, 1], scale: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}