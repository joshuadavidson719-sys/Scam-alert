import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2({ image }: { image: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-black overflow-hidden flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Left side: Black Gi Fox */}
      <motion.div 
        className="w-1/2 h-full relative overflow-hidden bg-black border-r-4 border-black z-10"
        initial={{ x: '-100%' }}
        animate={{ x: phase >= 1 ? '0%' : '-100%' }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      >
        <motion.img
          src={image}
          alt="Black Gi Fighter"
          className="absolute h-full w-[200%] max-w-none object-cover"
          style={{ objectPosition: '20% 50%' }}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1.3 }}
          transition={{ duration: 3.5, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
        <motion.div 
          className="absolute bottom-20 left-12"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : -50 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <h2 className="font-display text-8xl text-white">YUKI</h2>
          <p className="font-body text-red-500 font-bold tracking-widest uppercase">Shadow Style</p>
        </motion.div>
      </motion.div>

      {/* Right side: Red Gi Fox */}
      <motion.div 
        className="w-1/2 h-full relative overflow-hidden bg-red-950 z-0"
        initial={{ x: '100%' }}
        animate={{ x: phase >= 1 ? '0%' : '100%' }}
        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
      >
        <motion.img
          src={image}
          alt="Red Gi Fighter"
          className="absolute h-full w-[200%] max-w-none object-cover -left-[100%]"
          style={{ objectPosition: '80% 50%' }}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1.3 }}
          transition={{ duration: 3.5, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-red-900/80 to-transparent mix-blend-multiply" />
        <motion.div 
          className="absolute bottom-20 right-12 text-right"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : 50 }}
          transition={{ duration: 0.5, type: 'spring', delay: 0.2 }}
        >
          <h2 className="font-display text-8xl text-white">REN</h2>
          <p className="font-body text-yellow-500 font-bold tracking-widest uppercase">Crimson Fist</p>
        </motion.div>
      </motion.div>
      
      {/* Center VS flash */}
      {phase >= 3 && (
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 font-display text-9xl italic text-white drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]"
          initial={{ scale: 5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        >
          VS
        </motion.div>
      )}
    </motion.div>
  );
}