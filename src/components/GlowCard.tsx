/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  glowColor?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'none';
  className?: string;
  children?: React.ReactNode;
}

export default function GlowCard({
  id,
  title,
  subtitle,
  headerAction,
  glowColor = 'blue',
  className = '',
  children,
  ...props
}: GlowCardProps) {
  const getGlowStyles = () => {
    switch (glowColor) {
      case 'cyan':
        return 'border-[rgba(0,255,208,0.15)] shadow-[0_0_15px_-3px_rgba(0,255,208,0.1)] hover:border-[rgba(0,255,208,0.3)] hover:shadow-[0_0_20px_-2px_rgba(0,255,208,0.25)]';
      case 'blue':
        return 'border-[rgba(0,119,255,0.15)] shadow-[0_0_15px_-3px_rgba(0,119,255,0.1)] hover:border-[rgba(0,119,255,0.3)] hover:shadow-[0_0_20px_-2px_rgba(0,119,255,0.25)]';
      case 'emerald':
        return 'border-[rgba(16,185,129,0.15)] shadow-[0_0_15px_-3px_rgba(16,185,129,0.1)] hover:border-[rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_-2px_rgba(16,185,129,0.25)]';
      case 'amber':
        return 'border-[rgba(245,158,11,0.15)] shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)] hover:border-[rgba(245,158,11,0.3)] hover:shadow-[0_0_20px_-2px_rgba(245,158,11,0.25)]';
      case 'purple':
        return 'border-[rgba(168,85,247,0.15)] shadow-[0_0_15px_-3px_rgba(168,85,247,0.1)] hover:border-[rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_-2px_rgba(168,85,247,0.25)]';
      case 'red':
        return 'border-[rgba(239,68,68,0.15)] shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)] hover:border-[rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_-2px_rgba(239,68,68,0.25)]';
      case 'none':
      default:
        return 'border-slate-800 shadow-none';
    }
  };

  return (
    <div
      id={id}
      className={`relative glass-card p-5 transition-all duration-300 ease-out flex flex-col ${getGlowStyles()} ${className}`}
      {...props}
    >
      {/* Visual Glass highlights */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] pointer-events-none" />
      
      {/* Card Header if Title/Subtitle provided */}
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between mb-4 z-10">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-100 tracking-wide uppercase font-sans">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="flex items-center">{headerAction}</div>}
        </div>
      )}

      {/* Content wrapper */}
      <div className="relative z-10 flex-grow">
        {children}
      </div>
    </div>
  );
}
