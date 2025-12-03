import React, { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function PlayerSpriteGenerator() {
  const [config, setConfig] = useState({
    type: 'robot',
    color: '#00d9ff',
    size: 64,
    animated: true
  });
  
  const canvasRef = useRef(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = config.size;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Center point
    const cx = size / 2;
    const cy = size / 2;
    
    // Animation
    const pulse = Math.sin(frame * 0.1) * 2;
    
    if (config.type === 'robot') {
      // Robot body (rectangle)
      ctx.fillStyle = config.color;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);
      
      // Head
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 12, cy - 28, 24, 16);
      
      // Eyes
      ctx.fillStyle = config.color;
      ctx.fillRect(cx - 8, cy - 24, 6, 6);
      ctx.fillRect(cx + 2, cy - 24, 6, 6);
      
      // Animated antenna
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 28);
      ctx.lineTo(cx, cy - 36 - pulse);
      ctx.stroke();
      
      // Antenna tip
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(cx, cy - 36 - pulse, 3, 0, Math.PI * 2);
      ctx.fill();
      
    } else if (config.type === 'orb') {
      // Outer glow
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 25 + pulse);
      gradient.addColorStop(0, config.color);
      gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 25 + pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner color
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      
    } else if (config.type === 'tank') {
      // Tank body
      ctx.fillStyle = '#555';
      ctx.fillRect(cx - 18, cy - 12, 36, 24);
      
      // Turret
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Barrel (rotates with animation)
      const angle = frame * 0.05;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = '#333';
      ctx.fillRect(0, -3, 20, 6);
      ctx.restore();
      
      // Tracks
      ctx.fillStyle = '#333';
      ctx.fillRect(cx - 20, cy - 14, 6, 28);
      ctx.fillRect(cx + 14, cy - 14, 6, 28);
      
    } else if (config.type === 'drone') {
      // Center body
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Propellers (4 directions)
      const propellers = [
        [-15, -15], [15, -15], [-15, 15], [15, 15]
      ];
      
      propellers.forEach(([px, py]) => {
        // Arm
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + px, cy + py);
        ctx.stroke();
        
        // Propeller
        ctx.save();
        ctx.translate(cx + px, cy + py);
        ctx.rotate(frame * 0.3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.restore();
      });
    }
    
  }, [config, frame]);

  useEffect(() => {
    if (!config.animated) return;
    
    const interval = setInterval(() => {
      setFrame(f => f + 1);
    }, 50);
    
    return () => clearInterval(interval);
  }, [config.animated]);

  const downloadSprite = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `player_${config.type}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">Player Sprite Generator</h1>
        <p className="text-gray-400 mb-8">Create animated top-down player sprites (no arms!)</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Preview */}
          <div className="bg-gray-800 rounded-lg p-8 border-2 border-cyan-500">
            <h2 className="text-xl font-bold text-white mb-4">Preview</h2>
            <div className="bg-gray-900 rounded-lg p-8 flex items-center justify-center">
              <canvas 
                ref={canvasRef}
                width={config.size}
                height={config.size}
                className="border-2 border-gray-700"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <button
              onClick={downloadSprite}
              className="mt-4 w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Download size={20} />
              Download PNG
            </button>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Character Type</h3>
              <div className="grid grid-cols-2 gap-3">
                {['robot', 'orb', 'tank', 'drone'].map(type => (
                  <button
                    key={type}
                    onClick={() => setConfig({...config, type})}
                    className={`py-3 px-4 rounded-lg font-semibold capitalize transition ${
                      config.type === type
                        ? 'bg-cyan-500 text-black'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Color</h3>
              <div className="grid grid-cols-4 gap-3">
                {['#00d9ff', '#ff4444', '#00ff88', '#ffdd00', '#ff6633', '#aa00ff', '#ffffff', '#333333'].map(color => (
                  <button
                    key={color}
                    onClick={() => setConfig({...config, color})}
                    className={`h-12 rounded-lg border-2 transition ${
                      config.color === color ? 'border-white scale-110' : 'border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={config.color}
                onChange={(e) => setConfig({...config, color: e.target.value})}
                className="mt-4 w-full h-12 rounded-lg cursor-pointer"
              />
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Size: {config.size}px</h3>
              <input
                type="range"
                min="32"
                max="128"
                value={config.size}
                onChange={(e) => setConfig({...config, size: parseInt(e.target.value)})}
                className="w-full"
              />
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.animated}
                  onChange={(e) => setConfig({...config, animated: e.target.checked})}
                  className="w-5 h-5"
                />
                <span className="text-white font-semibold">Animated</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">💡 Usage Tips</h2>
          <ul className="text-gray-300 space-y-2">
            <li>• <strong>Robot:</strong> Animated antenna, perfect for sci-fi theme</li>
            <li>• <strong>Orb:</strong> Pulsing energy ball, mystical feel</li>
            <li>• <strong>Tank:</strong> Rotating turret, military style</li>
            <li>• <strong>Drone:</strong> Spinning propellers, high-tech look</li>
            <li>• Download and use in your game's rendering code</li>
            <li>• Create multiple colors for different player states</li>
          </ul>
        </div>
      </div>
    </div>
  );
}