import React from 'react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 select-none animate-in fade-in duration-300">
      <div className="flex flex-col items-center">
        {/* Centered Logo Badge (3x bigger: 240px) matching Figma */}
        <div className="relative w-56 h-56 sm:w-60 sm:h-60 rounded-full border-[8px] border-[#2357A4] flex items-center justify-center bg-white shadow-xl">
          <span className="text-[#2357A4] font-extrabold text-7xl sm:text-8xl tracking-tight select-none">
            BB
          </span>
          {/* Honey yellow accent dot scaled up */}
          <span className="absolute top-1 right-1 w-11 h-11 rounded-full bg-amber-400 border-[3px] border-white shadow-sm" />
        </div>

        {/* Three dots loading below the logo */}
        <div className="flex items-center gap-2.5 mt-12" aria-label="Loading...">
          <span
            className="w-3 h-3 rounded-full bg-[#2357A4] animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '900ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-[#2357A4] animate-bounce"
            style={{ animationDelay: '200ms', animationDuration: '900ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-[#2357A4] animate-bounce"
            style={{ animationDelay: '400ms', animationDuration: '900ms' }}
          />
        </div>
      </div>
    </div>
  );
};
