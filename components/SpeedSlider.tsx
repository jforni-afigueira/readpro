import React from 'react';
import { GaugeCircle } from 'lucide-react';
import { ThemeMode } from '../types';

interface SpeedSliderProps {
  rate: number;
  theme: ThemeMode;
  onRateChange: (rate: number) => void;
}

export const SpeedSlider: React.FC<SpeedSliderProps> = ({
  rate,
  theme,
  onRateChange,
}) => {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div 
        className="flex items-center justify-center shrink-0" 
        title={`Velocidade de reprodução: ${rate.toFixed(1)}x`}
      >
        <GaugeCircle 
          size={16} 
          strokeWidth={2}
          className={`shrink-0 ${theme === 'dark' ? 'text-amber-400' : 'text-blue-600'}`} 
        />
      </div>
      <input
        type="range"
        min="0.5"
        max="3.0"
        step="0.1"
        value={rate}
        onChange={(e) => onRateChange(parseFloat(e.target.value))}
        className={`w-16 sm:w-20 md:w-24 h-2.5 rounded-lg appearance-none cursor-pointer border shadow-inner transition-colors shrink-0 ${
          theme === 'dark' 
            ? 'bg-slate-700 hover:bg-slate-650 border-slate-600 accent-blue-400' 
            : theme === 'sepia'
            ? 'bg-[#dfceb0] hover:bg-[#d4c1a0] border-[#cbb692] accent-[#a46e2f]'
            : 'bg-slate-200 hover:bg-slate-300 border-slate-300 accent-blue-600'
        }`}
        title={`Velocidade: ${rate.toFixed(1)}x`}
        aria-label="Ajustar velocidade de leitura"
      />
      <span className={`text-[11px] font-mono font-bold w-7 text-left shrink-0 select-none ${
        theme === 'dark' ? 'text-slate-100' : theme === 'sepia' ? 'text-[#3d2c1b]' : 'text-slate-700'
      }`}>
        {rate.toFixed(1)}x
      </span>
    </div>
  );
};
