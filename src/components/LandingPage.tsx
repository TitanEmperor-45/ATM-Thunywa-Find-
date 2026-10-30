import React, { useState } from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-4">
      <div 
        className="cursor-pointer transition-transform duration-500 hover:scale-105"
        onClick={onEnter}
        role="button"
        aria-label="Enter Application"
      >
        <img
          src="/assets/aistudio/ATM_REal_LOGO_1dce9941.jpg"
          alt="ATM Thunywa Find Logo"
          className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-full shadow-2xl shadow-emerald-500/30 animate-spin-slow"
        />
        <h1 className="text-3xl font-bold text-white mt-8 tracking-tight">ATM Thunywa Find</h1>
        <p className="text-slate-400 mt-2 text-sm">Click the logo to enter</p>
      </div>
      
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
      `}</style>
    </div>
  );
}
