'use client';

import { createContext, useContext } from 'react';
import type { DeliveryEvent, MailingList, Subscriber } from '@/lib/types';

// Selekcija u centralnom panelu → sadržaj desnog panela ("brze info"). Isti obrazac kao u
// Terminal Travel panelu: tabela ne zna kako panel izgleda, panel ne zna odakle je selekcija.
// Provajder je u `Shell` jer on drži i stanje otvorenosti desnog panela.

export interface SubscriberInspect {
  kind: 'subscriber';
  subscriber: Subscriber;
  lists: MailingList[];
  /** Bounce/complaint/delivery zapisi za tu adresu — filtrirani na strani servera. */
  events: DeliveryEvent[];
}

export type InspectTarget = SubscriberInspect;

interface InspectorValue {
  target: InspectTarget | null;
  /** Postavlja selekciju i otvara desni panel; `null` je poništava. */
  inspect: (target: InspectTarget | null) => void;
}

const InspectorCtx = createContext<InspectorValue>({ target: null, inspect: () => {} });

export const InspectorProvider = InspectorCtx.Provider;

export function useInspector(): InspectorValue {
  return useContext(InspectorCtx);
}
