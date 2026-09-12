'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as campaigns from '@/lib/campaigns';
import * as subs from '@/lib/subscribers';
import { mutate, resetStore } from '@/lib/store';
import type { DmarcPhase } from '@/lib/types';

// Server akcije — jedini put od klijentskih komponenti do domenskog sloja. Svaka vraća
// `{ ok, error? }` umesto da baca, da forme mogu da prikažu poruku bez error boundary-ja.

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function wrap<T extends unknown[]>(fn: (...args: T) => Promise<string | void> | string | void) {
  return async (...args: T): Promise<ActionResult> => {
    try {
      const id = await fn(...args);
      return { ok: true, id: id ?? undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Nepoznata greška' };
    }
  };
}

function refresh(id?: string) {
  revalidatePath('/');
  revalidatePath('/kampanje');
  revalidatePath('/kalendar');
  revalidatePath('/analitika');
  if (id) revalidatePath(`/kampanje/${id}`);
}

export async function createCampaignAction(input: {
  name: string;
  listId: string;
  templateId: string;
  brief: string;
}): Promise<ActionResult> {
  let id: string;
  try {
    if (!input.name.trim()) throw new Error('Naziv kampanje je obavezan');
    if (!input.brief.trim()) throw new Error('Brif (ulazni podaci) je obavezan');
    id = campaigns.createCampaign(input).id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' };
  }
  refresh(id);
  redirect(`/kampanje/${id}`);
}

export const generateContentAction = wrap(async (id: string) => {
  await campaigns.generateContent(id);
  refresh(id);
});

export const updateDraftAction = wrap(
  async (
    id: string,
    patch: { name?: string; subject?: string; brief?: string; contentData?: Record<string, string> },
  ) => {
    campaigns.updateDraft(id, patch);
    refresh(id);
  },
);

export const submitForApprovalAction = wrap(async (id: string) => {
  campaigns.submitForApproval(id);
  refresh(id);
});

export const sendTestAction = wrap(async (id: string, recipients: string[]) => {
  await campaigns.sendTestEmail(id, recipients);
  refresh(id);
});

export const approveAction = wrap(async (id: string, sendAt: string | null) => {
  await campaigns.approve(id, sendAt);
  refresh(id);
});

export const rescheduleAction = wrap(async (id: string, sendAt: string) => {
  await campaigns.reschedule(id, sendAt);
  refresh(id);
});

export const cancelAction = wrap(async (id: string) => {
  await campaigns.cancel(id);
  refresh(id);
});

export const deleteCampaignAction = wrap(async (id: string) => {
  campaigns.deleteCampaign(id);
  refresh();
});

// --- pretplatnici ---

export const unsubscribeAction = wrap(async (id: string, listId: string) => {
  subs.unsubscribeFromList(id, listId);
  revalidatePath('/pretplatnici');
  revalidatePath('/liste');
});

export const deleteSubscriberAction = wrap(async (id: string, reason?: string) => {
  subs.deleteSubscriber(id, reason);
  revalidatePath('/pretplatnici');
  revalidatePath('/liste');
});

export const pauseSubscriberAction = wrap(async (id: string, paused: boolean) => {
  subs.pauseSubscriber(id, paused);
  revalidatePath('/pretplatnici');
  revalidatePath('/pretplatnici/sunset');
});

export const confirmOptinAction = wrap(async (id: string) => {
  subs.confirmDoubleOptin(id);
  revalidatePath('/pretplatnici');
});

/** Demo: simulira portal / booking webhook iz UI-ja (stvarni tok ide preko /api/webhooks/*). */
export const simulatePortalSignupAction = wrap(
  async (input: { email: string; name: string; company: string }) => {
    await subs.subscribeFromPortal({ ...input, portalAccountId: `portal-acc-${Date.now()}` });
    revalidatePath('/pretplatnici');
    revalidatePath('/liste');
    revalidatePath('/integracije');
  },
);

export const simulateBookingSignupAction = wrap(
  async (input: { email: string; name: string; consent: boolean }) => {
    const r = await subs.subscribeFromBooking({ ...input, bookingRef: `BK-${Date.now()}` });
    if (!r) throw new Error('Bez označenog pristanka nema prijave — ovo je očekivano ponašanje.');
    revalidatePath('/pretplatnici');
    revalidatePath('/liste');
    revalidatePath('/integracije');
  },
);

// --- podešavanja ---

export const updateSettingsAction = wrap(
  async (patch: {
    testRecipients?: string[];
    sunsetMonths?: number;
    reengagementEnabled?: boolean;
    minGapMinutes?: number;
    bigCampaignThreshold?: number;
  }) => {
    mutate((store) => {
      Object.assign(store.settings, patch);
    });
    revalidatePath('/podesavanja');
    revalidatePath('/kalendar');
  },
);

export const setDmarcPhaseAction = wrap(async (domain: string, phase: DmarcPhase) => {
  mutate((store) => {
    const d = store.settings.domains.find((x) => x.domain === domain);
    if (!d) throw new Error('Domen ne postoji');
    d.dmarcPhase = phase;
    d.dmarcSince = new Date().toISOString();
  });
  revalidatePath('/podesavanja');
});

export const toggleProductionAccessAction = wrap(async (domain: string) => {
  mutate((store) => {
    const d = store.settings.domains.find((x) => x.domain === domain);
    if (!d) throw new Error('Domen ne postoji');
    d.productionAccess = !d.productionAccess;
  });
  revalidatePath('/podesavanja');
});

export const resetDemoDataAction = wrap(async () => {
  resetStore();
  refresh();
  revalidatePath('/pretplatnici');
  revalidatePath('/liste');
  revalidatePath('/podesavanja');
});

function refreshSubscribers() {
  revalidatePath('/pretplatnici');
  revalidatePath('/pretplatnici/sunset');
  revalidatePath('/liste');
  revalidatePath('/');
}

export const createSubscriberAction = wrap(async (input: Omit<subs.ManualSubscriberInput, 'addedBy' | 'source'>) => {
  await subs.addSubscriberManual({
    ...input,
    addedBy: campaigns.CURRENT_USER,
    source: 'RUCNI_UNOS',
  });
  refreshSubscribers();
});

/** Vraća izveštaj umesto `ActionResult` — uvoz je delimično uspešan po prirodi. */
export async function importSubscribersAction(
  csv: string,
  opts: { defaultListIds: string[]; defaultConsentNote: string },
): Promise<{ ok: true; report: subs.ImportReport } | { ok: false; error: string }> {
  try {
    const report = await subs.importSubscribersCsv(csv, {
      addedBy: campaigns.CURRENT_USER,
      defaultListIds: opts.defaultListIds,
      defaultConsentNote: opts.defaultConsentNote,
    });
    refreshSubscribers();
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Nepoznata greška' };
  }
}

export const updateSubscriberAction = wrap(async (id: string, patch: subs.SubscriberPatch) => {
  await subs.updateSubscriber(id, patch);
  refreshSubscribers();
});
