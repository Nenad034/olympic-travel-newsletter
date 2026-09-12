'use client';

import { useRegisterTab } from './TabsContext';

/** Server-komponenta stranica ne može da zove hook — ovaj adapter registruje naslov taba. */
export default function RegisterTab({ label }: { label: string }) {
  useRegisterTab(label);
  return null;
}
