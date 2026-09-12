import { NextResponse } from 'next/server';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav';

export const dynamic = 'force-dynamic';

// Ista lista ekrana koju koriste ActivityBar, Sidebar i paleta komandi — bez druge, paralelne
// liste. Agent iz nje bira linkove (nikad izmišljenu rutu), a prozor razgovora njome puni meni
// „Otvori ekran". Ekvivalent /api/nav-items iz Terminal Travel panela; tamo je filtrirana po
// ulozi, ovde modul ima jednu ulogu (marketing tim), pa filtera nema.
export function GET() {
  return NextResponse.json({ items: NAV_ITEMS, groups: NAV_GROUPS });
}
