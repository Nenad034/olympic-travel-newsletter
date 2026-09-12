// Navigacija modula — grupe (ActivityBar) i stavke (Sidebar), isti model kao Terminal Travel panel.

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  description: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  itemIds: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'pocetna', label: 'Početna', href: '/', icon: 'home', description: 'Pregled stanja modula' },
  { id: 'kampanje', label: 'Kampanje', href: '/kampanje', icon: 'mail', description: 'Sve kampanje po statusu' },
  { id: 'nova-kampanja', label: 'Nova kampanja', href: '/kampanje/nova', icon: 'add', description: 'Kreiranje nacrta' },
  { id: 'kalendar', label: 'Kalendar slanja', href: '/kalendar', icon: 'calendar', description: 'Zakazane kampanje' },
  { id: 'odobrenja', label: 'Čeka odobrenje', href: '/kampanje?status=PENDING_APPROVAL', icon: 'checklist', description: 'Human-approval gate' },
  { id: 'liste', label: 'Liste i tokovi', href: '/liste', icon: 'list-tree', description: 'B2B operativna / promotivna, B2C' },
  { id: 'pretplatnici', label: 'Pretplatnici', href: '/pretplatnici', icon: 'organization', description: 'Baza sa pristancima' },
  { id: 'sunset', label: 'Sunset / re-engagement', href: '/pretplatnici/sunset', icon: 'history', description: 'Neaktivni 6+ meseci' },
  { id: 'sabloni', label: 'Šabloni', href: '/sabloni', icon: 'layout', description: 'HTML šabloni sa placeholder poljima' },
  { id: 'analitika', label: 'Analitika', href: '/analitika', icon: 'graph', description: 'Open/click/bounce po segmentu' },
  { id: 'isporuka', label: 'Isporuka i reputacija', href: '/analitika/isporuka', icon: 'shield', description: 'Bounce/complaint eventi po domenu' },
  { id: 'podesavanja', label: 'SES i domeni', href: '/podesavanja', icon: 'settings-gear', description: 'SPF/DKIM/DMARC, configuration sets' },
  { id: 'integracije', label: 'Integracije', href: '/integracije', icon: 'plug', description: 'Portal, booking, Listmonk, Cube' },
];

export const NAV_GROUPS: NavGroup[] = [
  { id: 'pocetna', label: 'Početna', icon: 'home', itemIds: ['pocetna'] },
  { id: 'kampanje', label: 'Kampanje', icon: 'mail', itemIds: ['kampanje', 'nova-kampanja', 'odobrenja', 'kalendar'] },
  { id: 'baza', label: 'Baza', icon: 'organization', itemIds: ['liste', 'pretplatnici', 'sunset'] },
  { id: 'sadrzaj', label: 'Sadržaj', icon: 'layout', itemIds: ['sabloni'] },
  { id: 'analitika', label: 'Analitika', icon: 'graph', itemIds: ['analitika', 'isporuka'] },
  { id: 'admin', label: 'Administracija', icon: 'settings-gear', itemIds: ['podesavanja', 'integracije'] },
];

export function groupForPath(pathname: string): NavGroup {
  const clean = pathname.split('?')[0];
  let best: { group: NavGroup; len: number } | null = null;
  for (const g of NAV_GROUPS) {
    for (const id of g.itemIds) {
      const item = NAV_ITEMS.find((i) => i.id === id);
      if (!item) continue;
      const href = item.href.split('?')[0];
      const match = href === '/' ? clean === '/' : clean === href || clean.startsWith(href + '/');
      if (match && (!best || href.length > best.len)) best = { group: g, len: href.length };
    }
  }
  return best?.group ?? NAV_GROUPS[0];
}

export function labelForPath(pathname: string): string {
  const clean = pathname.split('?')[0];
  let best: { label: string; len: number } | null = null;
  for (const item of NAV_ITEMS) {
    const href = item.href.split('?')[0];
    const match = href === '/' ? clean === '/' : clean === href || clean.startsWith(href + '/');
    if (match && (!best || href.length > best.len)) best = { label: item.label, len: href.length };
  }
  return best?.label ?? 'Stranica';
}
