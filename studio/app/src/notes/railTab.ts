import { create } from 'zustand';

export type RailTab = 'send' | 'sent' | 'replies';

/** Which tab of the notes rail is showing. Not remembered: every visit starts on the notes to send. */
export const useRail = create<{ tab: RailTab; setTab(tab: RailTab): void }>((set) => ({
  tab: 'send',
  setTab: (tab) => set({ tab }),
}));
