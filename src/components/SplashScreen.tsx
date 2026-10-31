import React from 'react';
import { LogoVariant } from '../types';
import { BusyBeesLogo } from './BusyBeesLogo';

interface SplashScreenProps {
  logoVariant?: LogoVariant;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ logoVariant = 'swoosh' }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 select-none animate-in fade-in duration-300">
      <div className="flex flex-col items-center">
        {/* Centered Animated Rupee-Bee Logo Emblem */}
        <div className="relative flex items-center justify-center rounded-full shadow-2xl">
          <BusyBeesLogo variant={logoVariant} size="splash" animated={true} />
        </div>

        {/* Brand Title */}
        <h1 className="mt-7 font-brand text-xl sm:text-2xl text-slate-900 dark:text-slate-100 tracking-wide">
          Busy Bees Expense Tracker
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          A little clarity, every day.
        </p>

        {/* Three dots loading below the logo */}
        <div className="flex items-center gap-2.5 mt-8" aria-label="Loading...">
          <span
            className="w-3 h-3 rounded-full bg-[#2357A4] dark:bg-blue-400 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '900ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-amber-400 animate-bounce"
            style={{ animationDelay: '200ms', animationDuration: '900ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-[#2357A4] dark:bg-blue-400 animate-bounce"
            style={{ animationDelay: '400ms', animationDuration: '900ms' }}
          />
        </div>
      </div>
    </div>
  );
};

