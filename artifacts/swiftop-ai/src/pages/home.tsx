import { useState } from "react";
import { useGenerateImage, useGenerateAnimation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Sparkles, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type GenerationResult = 
  | { type: "image"; prompt: string; b64_json: string }
  | { type: "animation"; prompt: string; frames: string[]; frameCount: number };

export default function Home() {
  const [mode, setMode] = useState<"image" | "animation">("image");
  const [prompt, setPrompt] = useState("");
  const [imageSize, setImageSize] = useState<"1024x1024" | "1536x1024" | "1024x1536">("1024x1024");
  const [frameCount, setFrameCount] = useState<number>(4);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [currentResult, setCurrentResult] = useState<GenerationResult | null>(null);

  const generateImage = useGenerateImage();
  const generateAnimation = useGenerateAnimation();

  const isGenerating = generateImage.isPending || generateAnimation.isPending;

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    if (mode === "image") {
      generateImage.mutate(
        { data: { prompt, size: imageSize } },
        {
          onSuccess: (data) => {
            const result: GenerationResult = { type: "image", prompt: data.prompt, b64_json: data.b64_json };
            setCurrentResult(result);
            setHistory(prev => [result, ...prev]);
          }
        }
      );
    } else {
      generateAnimation.mutate(
        { data: { prompt, frameCount } },
        {
          onSuccess: (data) => {
            const result: GenerationResult = { type: "animation", prompt: data.prompt, frames: data.frames, frameCount: data.frameCount };
            setCurrentResult(result);
            setHistory(prev => [result, ...prev]);
          }
        }
      );
    }
  };

  const handleDownload = (result: GenerationResult) => {
    if (result.type === "image") {
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${result.b64_json}`;
      link.download = `swiftop-${Date.now()}.png`;
      link.click();
    } else {
      // For animation, download first frame for now
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${result.frames[0]}`;
      link.download = `swiftop-frame-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-noise flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter glow-text text-primary">
            Swiftop AI
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            The cinematic darkroom for your imagination.
          </p>
        </div>

        {/* Workspace */}
        <div className="grid gap-8 lg:grid-cols-[1fr,300px] items-start">
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-card rounded-xl border border-card-border p-6 shadow-2xl">
                <div className="space-y-4">
                  <Textarea 
                    placeholder="Describe something extraordinary..."
                    className="min-h-[120px] resize-none text-lg bg-black/50 border-white/10 focus-visible:ring-primary/50"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    data-testid="input-prompt"
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex bg-black/50 rounded-lg p-1 border border-white/5">
                      <button
                        className={cn("flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium", mode === "image" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setMode("image")}
                        data-testid="mode-image"
                      >
                        <ImageIcon size={16} /> Image
                      </button>
                      <button
                        className={cn("flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium", mode === "animation" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => setMode("animation")}
                        data-testid="mode-animation"
                      >
                        <Video size={16} /> Animation
                      </button>
                    </div>

                    <Button 
                      size="lg" 
                      onClick={handleGenerate} 
                      disabled={!prompt.trim() || isGenerating}
                      className="w-full sm:w-auto glow-primary font-bold tracking-wide"
                      data-testid="button-generate"
                    >
                      {isGenerating ? (
                        <>
                          <Sparkles className="mr-2 h-5 w-5 animate-pulse" /> 
                          {mode === "image" ? "Developing..." : "Rendering Sequence..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" /> Generate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="bg-card rounded-xl border border-card-border p-6 space-y-6">
            <h3 className="font-semibold text-lg tracking-tight border-b border-border pb-4">Settings</h3>
            
            {mode === "image" ? (
              <div className="space-y-3">
                <Label>Format</Label>
                <Select value={imageSize} onValueChange={(val: any) => setImageSize(val)} data-testid="select-size">
                  <SelectTrigger className="bg-black/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024x1024">Square (1:1)</SelectItem>
                    <SelectItem value="1536x1024">Landscape (16:9)</SelectItem>
                    <SelectItem value="1024x1536">Portrait (9:16)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Frames</Label>
                <Select value={frameCount.toString()} onValueChange={(val) => setFrameCount(parseInt(val))} data-testid="select-frames">
                  <SelectTrigger className="bg-black/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Frames (Fast)</SelectItem>
                    <SelectItem value="4">4 Frames (Standard)</SelectItem>
                    <SelectItem value="6">6 Frames (Smooth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Current Result Display */}
        <div className="w-full">
          {isGenerating ? (
            <div className="aspect-video w-full max-w-3xl mx-auto rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center space-y-6 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent animate-pulse"></div>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-muted-foreground font-mono text-sm tracking-widest uppercase">
                {mode === "image" ? "Synthesizing pixels..." : `Processing ${frameCount} frames...`}
              </div>
            </div>
          ) : currentResult ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="relative group max-w-4xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-2xl">
                {currentResult.type === "image" ? (
                  <img 
                    src={`data:image/png;base64,${currentResult.b64_json}`} 
                    alt={currentResult.prompt}
                    className="w-full h-auto object-contain"
                  />
                ) : (
                  <AnimatedFrames frames={currentResult.frames} />
                )}
                
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-end justify-between">
                  <p className="text-sm text-white/80 max-w-[80%] line-clamp-2">
                    {currentResult.prompt}
                  </p>
                  <Button size="icon" variant="secondary" onClick={() => handleDownload(currentResult)} data-testid="button-download">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* History Gallery */}
        {history.length > 0 && (
          <div className="pt-12 border-t border-white/5 space-y-6">
            <h3 className="text-xl font-semibold tracking-tight text-muted-foreground">Session History</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {history.map((item, idx) => (
                <div 
                  key={idx} 
                  className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 bg-black/20 cursor-pointer"
                  onClick={() => setCurrentResult(item)}
                >
                  {item.type === "image" ? (
                    <img src={`data:image/png;base64,${item.b64_json}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full relative">
                      <img src={`data:image/png;base64,${item.frames[0]}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] uppercase tracking-wider text-white flex items-center gap-1">
                        <Video size={12} /> {item.frameCount}f
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedFrames({ frames }: { frames: string[] }) {
  const [index, setIndex] = useState(0);

  // ~3fps = 333ms per frame
  import("react").then((React) => {
    React.useEffect(() => {
      const interval = setInterval(() => {
        setIndex((i) => (i + 1) % frames.length);
      }, 333);
      return () => clearInterval(interval);
    }, [frames.length]);
  });

  return (
    <img 
      src={`data:image/png;base64,${frames[index]}`} 
      className="w-full h-auto object-contain"
      alt="Animation frame"
    />
  );
}
