'use client';

import TabBar from './TabBar';
import { BrandLogoFull, BrandLogoShort } from './BrandMark';

const HEADER_PADDING_GAP = 12;

// Gornja traka: logo iznad leve kolone (širina se MERI u Shell.tsx), tabovi počinju od leve
// ivice centralnog panela. Ostale ikonice žive u desnoj vertikalnoj traci (RightRail).
export default function TopBar({ leftColumnWidth }: { leftColumnWidth: number }) {
  const spacerWidth = Math.max(0, leftColumnWidth - HEADER_PADDING_GAP);
  const showLabel = spacerWidth >= 120;

  return (
    <header className="flex h-[43px] flex-shrink-0 items-center gap-1 bg-bar px-2 text-xs">
      <div
        className={`relative flex flex-shrink-0 items-center gap-2 ${showLabel ? 'px-2' : 'justify-center px-0'}`}
        style={{ width: spacerWidth }}
      >
        {showLabel ? <BrandLogoFull heightPx={23} /> : <BrandLogoShort heightPx={18} />}
      </div>
      <div className="flex h-full min-w-0 flex-1">
        <TabBar />
      </div>
    </header>
  );
}
