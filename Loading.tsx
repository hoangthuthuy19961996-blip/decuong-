import React from 'react';

export const Loading: React.FC<{ text?: string }> = ({ text = "Thinking..." }) => (
  <div className="flex flex-col items-center justify-center space-y-4 p-8">
    <div className="relative w-16 h-16">
      <div className="absolute top-0 left-0 w-full h-full border-4 border-primary/30 rounded-full"></div>
      <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
    </div>
    <p className="text-primary font-semibold animate-pulse">{text}</p>
  </div>
);