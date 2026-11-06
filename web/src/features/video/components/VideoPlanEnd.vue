<template>
  <!-- Down one side, the network given the rest: the plan, what it changes, each figure rolling on from today's, and where to see it for yourself. -->
  <section
    v-if="shown > 0"
    class="absolute top-1/2 left-[5vmin] flex flex-col gap-[2.4vmin] rounded-[1.4vmin] bg-[#0b0d10]/92 p-[3vmin] ring-1 ring-white/10"
    :style="{ width: `${PLAN_END_VW}vw`, opacity: shown, transform: `translate(${(shown - 1) * 4}vmin, -50%)` }">
    <div>
      <p class="text-[2vmin] font-semibold tracking-[0.2em] text-white/70 uppercase">{{ PLAN_STATUSES[plan.status].label }}</p>
      <h2 class="mt-[0.6vmin] text-[7vmin] leading-none font-extrabold tracking-tight">{{ plan.name }}</h2>
    </div>
    <dl class="flex flex-col gap-[1.8vmin]">
      <div v-for="gain in gains" :key="gain.label">
        <dt class="text-[1.8vmin] font-semibold tracking-[0.14em] text-white/60 uppercase">{{ gain.label }}</dt>
        <dd class="flex items-baseline gap-[1vmin] text-[4.4vmin] leading-tight font-extrabold tracking-tight">
          <span class="text-[2.8vmin] font-medium text-white/60">{{ gain.before }} →</span>
          <span><ReelNumber :count="countOf(gain.from, gain.to, counted, INSIGHTS_DRAW_MS)" :decimals="gain.decimals" />{{ gain.unit }}</span>
        </dd>
      </div>
    </dl>
    <p class="text-[2.2vmin] text-white/65">
      Play any city's history yourself:<br />
      <span class="font-semibold text-white">{{ address }}</span>
    </p>
  </section>
</template>

<script setup lang="ts">
  import type { PlanInfo } from '@railtime/network/facts.types';
  import { PLAN_STATUSES } from '~/constants/plan.constants';
  import { INSIGHTS_DRAW_MS } from '~/features/video/insights/insights.constants';
  import type { PlanGain } from '~/features/video/insights/insights.types';
  import { PLAN_END_VW } from '~/features/video/video.constants';
  import { countOf } from '~/utils/count.utils';

  defineProps<{
    /** The plan the video ends on. */
    plan: PlanInfo;
    /** What it changes. */
    gains: PlanGain[];
    /** How long its numbers have counted, ms. */
    counted: number;
    /** Where the site is, as said (`example.org`). */
    address: string;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();
</script>
