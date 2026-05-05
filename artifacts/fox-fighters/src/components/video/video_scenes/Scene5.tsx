import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5({ image }: { image: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-red-600 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.img
        src={image}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-50"
        initial={{ scale: 1 }}
        animate={{ scale: 1.1 }}
        transition={{ duration: 3.5, ease: "linear" }}
      />
      
      {/* Rapid screen shake / impact effect */}
      <motion.div
        className="relative z-10 font-display text-[25vw] leading-none text-white italic tracking-tighter"
        initial={{ scale: 2, opacity: 0, rotate: -5 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 10 }}
      >
        <motion.div
          animate={{ x: [0, -10, 10, -5, 5, 0], y: [0, 10, -10, 5, -5, 0] }}
          transition={{ duration: 0.4, ease: "linear" }}
          className="drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]"
        >
          FIGHT!
        </motion.div>
      </motion.div>

      {phase >= 2 && (
        <motion.div 
          className="absolute inset-0 bg-white mix-blend-overlay pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      )}
    </motion.div>
  );
}