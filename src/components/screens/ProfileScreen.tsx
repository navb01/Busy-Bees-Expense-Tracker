import React, { useState } from 'react';
import { UserProfile } from '../../types';

interface ProfileScreenProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ profile, onSaveProfile }) => {
  const [name, setName] = useState(profile.name || '');
  const [age, setAge] = useState(profile.age || '');
  const [occupation, setOccupation] = useState(profile.occupation || '');
  const [city, setCity] = useState(profile.city || '');
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      age: age.trim(),
      occupation: occupation.trim(),
      city: city.trim(),
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 flex flex-col justify-between px-6 pt-6 pb-20 sm:pb-8 max-w-lg mx-auto w-full"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">A little more you.</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Personalize Busy Bees Expense Tracker on this device. No account required.
          </p>
        </div>

        <div className="space-y-5">
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

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Your profile and records stay on your device.
        </p>

        {savedMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
            Profile saved successfully!
          </div>
        )}
      </div>

      <div className="pt-6 mt-6 pb-6 sm:pb-0">
        <button
          type="submit"
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm"
        >
          Save profile
        </button>
      </div>
    </form>
  );
};
