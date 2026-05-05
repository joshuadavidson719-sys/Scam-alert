import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import foxFightersImg from "@assets/3QgLp_1777959049416.jpg";

export const SCENE_DURATIONS: Record<string, number> = {
  intro: 4000,
  challengers: 3500,
  standoff: 4500,
  round1: 3000,
  fight: 3500,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: () => <Scene1 image={foxFightersImg} />,
  challengers: () => <Scene2 image={foxFightersImg} />,
  standoff: () => <Scene3 image={foxFightersImg} />,
  round1: () => <Scene4 image={foxFightersImg} />,
  fight: () => <Scene5 image={foxFightersImg} />,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[#050505] font-body text-white">
      {/* Persistent Background Effects */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute inset-0 opacity-10 bg-repeat bg-[length:100px_100px]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          animate={{ x: [0, -10, 10, 0], y: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 0.2, ease: "linear" }}
        />

        {/* Dynamic vignette */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.8) 100%)' }}
          animate={{ opacity: sceneIndex === 4 ? 0.9 : 0.7 }}
          transition={{ duration: 1 }}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
