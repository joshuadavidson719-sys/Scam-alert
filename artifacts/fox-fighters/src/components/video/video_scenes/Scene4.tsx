import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4({ image }: { image: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.img
        src={image}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl grayscale"
        animate={{ scale: [1, 1.05], rotate: [0, -1] }}
        transition={{ duration: 3, ease: "linear" }}
      />
      
      <div className="relative z-10 flex items-center gap-12 font-display text-[15vw] leading-none text-white italic">
        {phase >= 1 && (
          <motion.div
            initial={{ x: -200, opacity: 0, skewX: -20 }}
            animate={{ x: 0, opacity: 1, skewX: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            ROUND
          </motion.div>
        )}
        
        {phase >= 2 && (
          <motion.div
            className="text-red-600"
            initial={{ scale: 5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            1
          </motion.div>
        )}
      </div>

      {/* Speed lines effect */}
      {phase >= 2 && (
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.3, repeat: 3 }}
        >
          <div className="w-full h-full" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
        </motion.div>
      )}
    </motion.div>
  );
}