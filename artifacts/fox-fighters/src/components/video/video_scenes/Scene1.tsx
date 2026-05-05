import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1({ image }: { image: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.15 }}
    >
      {/* Slow atmospheric pan on the dojo background (blurred/dark) */}
      <motion.img
        src={image}
        alt="Dojo"
        className="absolute w-[150vw] h-[150vh] object-cover opacity-30 blur-sm"
        initial={{ scale: 1.2, x: '-5%', y: '-5%' }}
        animate={{ scale: 1.4, x: '5%', y: '5%' }}
        transition={{ duration: 5, ease: "linear" }}
      />

      <div className="relative z-10 text-center flex flex-col items-center">
        <motion.div 
          className="h-[2px] bg-red-600 mb-6"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: phase >= 1 ? 200 : 0, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        
        <motion.h2 
          className="text-xl md:text-3xl font-body tracking-[0.5em] text-gray-400 uppercase"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 20 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          Neo Kyoto
        </motion.h2>
        
        <motion.h1 
          className="text-7xl md:text-9xl font-display text-white mt-2 leading-none"
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.9, filter: phase >= 2 ? 'blur(0px)' : 'blur(10px)' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          THE DOJO
        </motion.h1>
        
        <motion.div 
          className="h-[2px] bg-red-600 mt-6"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: phase >= 1 ? 200 : 0, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </motion.div>
  );
}