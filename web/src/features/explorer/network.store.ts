import { NetworkFacts } from '@railtime/network/facts.service';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';

/**
 * The network the explorer shows: the city's network as stored, the plan picked, and the facts made
 * from them with the lines hidden left out, for every question about it. Another plan, or lines
 * hidden or shown, make the facts again; it reads no other store.
 */
export const useNetworkStore = defineStore(STORE_IDS.EXPLORER_NETWORK, () => {
  // ---- State
  /** The city's network as stored, every plan and line in it. */
  const stored = shallowRef<Network | null>(null);
  /** The plan picked, if any: shown while every line it builds on is, and kept in the address either way. */
  const pickedPlan = shallowRef<string | undefined>(undefined);
  /** The network shown, its facts: the plan picked built on it, the lines hidden left out. */
  const facts = shallowRef<NetworkFacts | null>(null);

  // ---- Getters
  /** The plan shown, if any: its changes are what plays, and the network it builds is "at rest". */
  const plan = computed(() => facts.value?.plan ?? undefined);
  /** A network never built: no history, only its plan to play. */
  const planOnly = computed(() => facts.value?.planOnly ?? false);
  /** The city's plans, each with what it would add. */
  const plans = computed(() => facts.value?.plans() ?? []);
  /** Each network with the lines that may be shown or hidden, hidden ones too. */
  const networkChoices = computed(() => facts.value?.networkChoices() ?? []);
  /** The lines hidden. */
  const hidden = computed(() => facts.value?.hidden ?? []);
  /** Every line. */
  const lines = computed(() => facts.value?.lines() ?? []);
  /** Every change in the history, planned ones last. */
  const changes = computed(() => facts.value?.changes() ?? []);
  /** The network year by year, and the stations each decade opened. */
  const growth = computed(() => facts.value?.growth() ?? null);
  /** Whether some year has a station on the map: one never built has only its plans. */
  const hasHistory = computed(() => facts.value?.hasHistory() ?? false);
  /** The timeline's span. */
  const range = computed(() => facts.value?.range ?? null);

  // ---- Actions
  /**
   * Makes the facts again from the network as stored.
   *
   * @param shownPlan - The plan to show built on it; none for the network as built.
   * @param hiddenLines - The lines to leave out.
   */
  const MAKE = (shownPlan: string | undefined, hiddenLines: readonly string[]) => {
    if (!stored.value) return;
    facts.value = markRaw(NetworkFacts.create(stored.value, { ...(shownPlan && { plan: shownPlan }), hidden: hiddenLines }));
  };
  /**
   * Opens a city's network, with the plan asked for: a network never built shows its first plan
   * unless another is asked for (`NetworkFacts.planToOpen`).
   *
   * @param network - The network, as stored.
   * @param asked - The plan the address asks for, if any.
   */
  const OPEN = (network: Network, asked: string | undefined) => {
    stored.value = markRaw(network);
    pickedPlan.value = NetworkFacts.planToOpen(network, asked);
    MAKE(pickedPlan.value, []);
  };
  /**
   * Shows another plan, or the network as built, with the same lines hidden.
   *
   * @param shownPlan - The plan; none for the network as built.
   */
  const SHOW_PLAN = (shownPlan: string | undefined) => {
    pickedPlan.value = shownPlan;
    MAKE(shownPlan, hidden.value);
  };
  /**
   * Shows some lines, or hides them as if they were not there: every count, the history and the
   * coverage leave them out. The plan picked goes while a line it builds on is hidden, and is back once
   * it shows.
   *
   * @param ids - The lines.
   * @param shown - Whether to show them.
   */
  const SHOW_LINES = (ids: readonly string[], shown: boolean) => {
    MAKE(pickedPlan.value, shown ? hidden.value.filter(id => !ids.includes(id)) : [...new Set([...hidden.value, ...ids])]);
  };

  return {
    // State
    stored,
    pickedPlan,
    facts,
    // Getters
    plan,
    planOnly,
    plans,
    networkChoices,
    hidden,
    lines,
    changes,
    growth,
    hasHistory,
    range,
    // Actions
    OPEN,
    SHOW_PLAN,
    SHOW_LINES,
  };
});
