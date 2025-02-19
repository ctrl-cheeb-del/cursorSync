import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "./ui/card";
import { Loader2 } from "lucide-react";

interface ProgressStep {
  label: string;
  status: 'pending' | 'current' | 'completed' | 'error';
}

interface ScreenshotPreviewProps {
  imageUrl?: string;
  timestamp?: string;
  steps: ProgressStep[];
}

export default function ScreenshotPreview({ imageUrl, timestamp, steps }: ScreenshotPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState(0);

  // Debug props
  console.log('ScreenshotPreview props:', { imageUrl, timestamp });

  useEffect(() => {
    if (!imageUrl) {
      console.log('No image URL provided');
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    console.log('New image URL received:', imageUrl);
    
    // Test image loading
    const img = new Image();
    img.onload = () => {
      console.log('Image loaded successfully:', { width: img.width, height: img.height });
    };
    img.onerror = (error) => {
      console.error('Failed to load image:', error);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const updateTransform = useCallback(() => {
    if (containerRef.current && imageRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();
      
      const maxX = (imageRect.width * scale - containerRect.width) / 2;
      const maxY = (imageRect.height * scale - containerRect.height) / 2;
      
      setPosition(prev => ({
        x: Math.min(Math.max(-maxX, prev.x), maxX),
        y: Math.min(Math.max(-maxY, prev.y), maxY)
      }));
    }
  }, [scale]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newScale = Math.min(Math.max(1, scale + delta), 4);
    
    if (imageRef.current && containerRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const scaleChange = newScale - scale;
      setPosition(prev => ({
        x: prev.x - (x * scaleChange),
        y: prev.y - (y * scaleChange)
      }));
      
      setScale(newScale);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPos({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
    updateTransform();
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      
      setStartPos({
        x: centerX - position.x,
        y: centerY - position.y
      });
      
      setInitialPinchDistance(dist / scale);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setStartPos({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
      const newScale = Math.min(Math.max(1, dist / initialPinchDistance), 4);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      setPosition({
        x: centerX - startPos.x,
        y: centerY - startPos.y
      });
      setScale(newScale);
      updateTransform();
    } else if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - startPos.x,
        y: touch.clientY - startPos.y
      });
      updateTransform();
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const handleDoubleClick = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!imageUrl) {
    return (
      <Card className="relative overflow-hidden bg-black h-[60vh] mt-4 border border-border/40">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 space-y-8 p-4">
          <div className="w-full max-w-[280px] space-y-6">
            {steps.map((step, index) => (
              <div 
                key={step.label} 
                className="flex items-center gap-3 px-2"
              >
                <div className="flex-none">
                  {step.status === 'current' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : step.status === 'completed' ? (
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                  ) : step.status === 'error' ? (
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/20" />
                  )}
                </div>
                <span className={`flex-none min-w-[120px] ${
                  step.status === 'current' ? 'text-white' :
                  step.status === 'completed' ? 'text-white/70' :
                  step.status === 'error' ? 'text-red-400' :
                  'text-white/40'
                }`}>
                  {step.label}
                </span>
                {step.status === 'current' && (
                  <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
                    <div className="h-full bg-white/40 animate-progress" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  console.log('Rendering preview with image');
  return (
    <Card className="relative overflow-hidden bg-black h-[60vh] mt-4 border border-border/40">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center cursor-grab touch-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Screen Preview"
          className="w-full h-full object-contain select-none will-change-transform"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: 'center',
            cursor: isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            perspective: '1000px',
            WebkitPerspective: '1000px'
          }}
          draggable={false}
          onLoad={() => console.log('Image element loaded')}
          onError={(e) => console.error('Image element failed to load:', e)}
        />
        {timestamp && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
            {new Date(parseInt(timestamp)).toLocaleTimeString()}
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white/70 px-2 py-1 rounded text-xs pointer-events-none md:hidden">
        Tap to zoom, drag to pan
      </div>
    </Card>
  );
}
