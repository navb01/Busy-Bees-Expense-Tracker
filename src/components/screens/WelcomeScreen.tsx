import React, { useState } from 'react';
import { UserProfile } from '../../types';

interface WelcomeScreenProps {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  initialProfile,
  onComplete,
}) => {
  const [name, setName] = useState(initialProfile.name || '');
  const [age, setAge] = useState(initialProfile.age || '');
  const [occupation, setOccupation] = useState(initialProfile.occupation || '');
  const [city, setCity] = useState(initialProfile.city || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      name: name.trim(),
      age: age.trim(),
      occupation: occupation.trim(),
      city: city.trim(),
    });
  };

  const handleSkip = () => {
    onComplete({
      name: name.trim(),
      age: age.trim(),
      occupation: occupation.trim(),
      city: city.trim(),
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-11 pb-10 sm:pt-8 sm:pb-8 max-w-lg mx-auto w-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2357A4] dark:text-blue-400">
                Welcome Aboard
              </span>
              <h1 className="text-xl sm:text-2xl font-brand text-slate-900 dark:text-slate-100 leading-tight mt-0.5 tracking-wide">
                Busy Bees Expense Tracker
              </h1>
            </div>
            <div
              className="w-11 h-11 rounded-full border-2 border-[#2357A4] dark:border-blue-400 flex items-center justify-center text-[#2357A4] dark:text-blue-400 font-bold text-sm bg-white dark:bg-slate-800 shadow-xs select-none shrink-0"
              aria-label="Busy Bees Logo"
            >
              BB
            </div>
          </div>

          {/* Intro Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              A little more you.
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Set up your user profile on this device before you begin. No cloud account required — your details stay strictly on your phone.
            </p>
          </div>

          {/* User Profile Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Add name"
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Age
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Add age"
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Add occupation"
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Add city"
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 mt-6 space-y-2.5">
          <button
            type="submit"
            className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm"
          >
            Save & Continue
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
};
