import React from 'react';

export default function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>

      {/* Main Map Pin Body */}
      <path
        d="M100 180 C100 180 40 110 40 75 C40 41.863 66.863 15 100 15 C133.137 15 160 41.863 160 75 C160 110 100 180 100 180 Z"
        fill="url(#logoGrad)"
      />

      {/* Sprout Cutout (Transparent / White) */}
      <path
        d="M100 120 
           C100 120 100 95 125 80 
           C140 71 145 50 145 50 
           C145 50 120 50 108 65 
           C103 71 101 80 100 85 
           C99 80 97 71 92 65 
           C80 50 55 50 55 50 
           C55 50 60 71 75 80 
           C100 95 100 120 100 120 Z"
        fill="white"
      />
    </svg>
  );
}
