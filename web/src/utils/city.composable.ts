import { useFetch, useRuntimeConfig } from '#imports';
import type { Network } from '@railtime/schema/network.types';
import type { Ref } from 'vue';

import { networkUrlOf } from '~/utils/city.utils';

/**
 * A city's network, fetched in the browser, where the map that draws it runs: the explorer's and a
 * video's. The base URL is joined here, as for the pictures: ofetch leaves a relative path as it is
 * when the base is `/`, and the browser would resolve it against the page's own address (/london/data/…).
 *
 * @param city - The city, by its id.
 * @returns The network once fetched, and what went wrong, if anything.
 */
export const useCityNetwork = (city: Ref<string>): { network: Ref<Network | undefined>; error: Ref<Error | undefined> } => {
  const baseURL = useRuntimeConfig().app.baseURL;
  const { data, error } = useFetch<Network>(() => `${baseURL}${networkUrlOf(city.value)}`, { server: false });
  return { network: data, error };
};
