import type { Locale } from '@/i18n';

/**
 * Placeholder programme for the Phase 1 landing page.
 *
 * These are NOT real events. There is no events table yet and nothing here is
 * registrable. Every card renders a visible "sample" marker in both locales so
 * no one — client or visitor — can mistake it for a published calendar.
 * Phase 2 replaces this module wholesale with the events read model.
 *
 * The venues are real CRDB-mapped institutions from the seed register, so the
 * layout is exercised against name lengths the live data will actually produce.
 */
export interface SampleEvent {
  id: string;
  status: 'live' | 'upcoming';
  title: Record<Locale, string>;
  venue: string;
  city: string;
  /** Deliberately relative — no real date is asserted. */
  when: Record<Locale, string>;
}

export const sampleEvents: SampleEvent[] = [
  {
    id: 'sample-1',
    status: 'live',
    title: {
      en: 'Campus money clinic',
      sw: 'Kliniki ya fedha chuoni',
    },
    venue: 'University of Dar es Salaam',
    city: 'Dar es Salaam',
    when: { en: 'Happening today', sw: 'Inaendelea leo' },
  },
  {
    id: 'sample-2',
    status: 'upcoming',
    title: {
      en: 'Konekt career fair',
      sw: 'Maonyesho ya ajira ya Konekt',
    },
    venue: 'St. Augustine University of Tanzania',
    city: 'Mwanza',
    when: { en: 'Next week', sw: 'Wiki ijayo' },
  },
  {
    id: 'sample-3',
    status: 'upcoming',
    title: {
      en: 'Savings challenge launch',
      sw: 'Uzinduzi wa changamoto ya akiba',
    },
    venue: 'University of Dodoma',
    city: 'Dodoma',
    when: { en: 'Later this month', sw: 'Mwishoni mwa mwezi huu' },
  },
];
