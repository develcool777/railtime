<template>
  <TextPage title="Privacy policy" :description="`Last updated ${LEGAL_UPDATED}.`">
    <TextSection title="What the site collects">
      <p class="text-muted">
        You don't need an account, and the site never asks for your name or email address. It doesn't run analytics of its own. It only remembers whether you
        chose the light or dark theme, in your browser's local storage.
      </p>
    </TextSection>

    <TextSection title="Services that see your visit">
      <p class="text-muted">Your browser contacts these services, which receive your IP address and basic browser details:</p>
      <ul class="text-muted flex list-disc flex-col gap-2 pl-5">
        <li><TextLink to="https://www.cloudflare.com/privacypolicy/">Cloudflare</TextLink> hosts the site.</li>
        <li><TextLink to="https://openfreemap.org/privacy/">OpenFreeMap</TextLink> delivers the background map.</li>
      </ul>
    </TextSection>

    <TextSection title="Advertising">
      <p class="text-muted">
        The site may show ads from Google. Third-party vendors, including Google, use cookies to serve ads based on your earlier visits to this site or other
        websites. Google and its partners may also place and read cookies, or use web beacons or IP addresses, to collect information as a result of showing
        ads.
      </p>
      <p class="text-muted">
        You can turn off personalised ads in Google's <TextLink to="https://www.google.com/settings/ads">Ads Settings</TextLink>, or opt out of other vendors'
        cookies at <TextLink to="https://www.aboutads.info">aboutads.info</TextLink>. Google explains
        <TextLink to="https://policies.google.com/technologies/partner-sites">how it uses data from sites like this one</TextLink>. If you are in the European
        Economic Area, the UK or Switzerland, you are asked for your consent first, where the law requires it.
      </p>
    </TextSection>

    <TextSection title="Changes">
      <p class="text-muted">If this policy changes, the new version appears here with a new date at the top.</p>
    </TextSection>
  </TextPage>
</template>

<script setup lang="ts">
  import { LEGAL_UPDATED } from '~/features/about/about.constants';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { privacySeo } from '~/features/seo/seo.utils';

  usePageSeo(privacySeo());
</script>
