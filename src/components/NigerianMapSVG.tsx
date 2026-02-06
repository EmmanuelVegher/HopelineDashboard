import React, { PropsWithChildren } from 'react';
import { cn } from "@/lib/utils";
import { NIGERIA_STATE_PATHS } from "./NigeriaStatePaths";

/**
 * NigerianMapSVG Component
 * 
 * A high-fidelity, geographically accurate SVG map of Nigeria.
 * Viewbox: 0 0 800 650 (Standard geographic aspect ratio for Nigeria)
 */

interface NigerianMapSVGProps {
  className?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export const NigerianMapSVG: React.FC<PropsWithChildren<NigerianMapSVGProps>> = ({
  className,
  fill = "#F8FAFC", // slate-50
  stroke = "#CBD5E1", // slate-300
  strokeWidth = 1.5,
  children
}) => {
  return (
    <svg
      viewBox="0 0 745 600"
      className={cn("w-full h-full drop-shadow-sm", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Detailed State Paths */}
      <g className="state-paths">
        {(Object.entries(NIGERIA_STATE_PATHS) as [string, string][]).map(([stateName, pathData]) => (
          <path
            key={stateName}
            d={pathData}
            fill={fill === "#F8FAFC" ? "#1F4D36" : fill} // Default to Dark Forest Green for high visibility
            stroke={stroke === "#CBD5E1" ? "#FFFFFF" : stroke} // Default to White if generic slate is passed
            strokeWidth={strokeWidth}
            className="transition-colors duration-300 hover:opacity-90"
          >
            <title>{stateName}</title>
          </path>
        ))}
      </g>
      {/* Decorative Graticule/Grid */}
      <g opacity="0.1" stroke="#94A3B8" strokeWidth="0.5">
        <line x1="0" y1="130" x2="800" y2="130" />
        <line x1="0" y1="260" x2="800" y2="260" />
        <line x1="0" y1="390" x2="800" y2="390" />
        <line x1="0" y1="520" x2="800" y2="520" />
        <line x1="200" y1="0" x2="200" y2="650" />
        <line x1="400" y1="0" x2="400" y2="650" />
        <line x1="600" y1="0" x2="600" y2="650" />
      </g>
      {/* Overlay Data Points */}
      {children}
    </svg>
  );
};
