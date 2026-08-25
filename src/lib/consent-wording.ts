/**
 * The exact words shown next to each switch.
 *
 * Stored with the consent, not referenced by a version number that could be
 * edited later: reproducing a consent means reproducing what the person
 * actually read. If any of these sentences changes, the version below changes
 * with it, and old rows keep the sentence they were given.
 */
export const CONSENT_WORDING: Record<string, { en: string; sw: string }> = {
  'event_reminders:sms': {
    en: 'Send me an SMS reminder before events I have registered for.',
    sw: 'Nitumie ujumbe wa SMS kunikumbusha kabla ya matukio niliyojiandikisha.',
  },
  'marketing:sms': {
    en: 'Send me offers and news about Konekt by SMS. This is separate from event reminders, and saying no changes nothing else.',
    sw: 'Nitumie matangazo na habari za Konekt kwa SMS. Hii ni tofauti na vikumbusho vya matukio, na kukataa hakubadilishi kitu kingine.',
  },
  'photo_use': {
    en: 'Photographs taken of me at Konekt events may be used in Konekt and CRDB materials.',
    sw: 'Picha zangu zilizopigwa kwenye matukio ya Konekt zinaweza kutumika katika machapisho ya Konekt na CRDB.',
  },
};

export const WORDING_VERSION = '2026-08-25';
