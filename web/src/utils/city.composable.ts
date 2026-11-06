import type { Network } from '@railtime/schema/network.types';
import { servedNetwork } from '@railtime/schema/served.utils';
import type { Ref } from 'vue';
import { useFetch, useRuntimeConfig } from '#imports';
import { networkUrlOf } from '~/utils/city.utils';

/**
 * A city's network, fetched in the browser, where the map that draws it runs: the explorer's and a
 * video's. The base URL is joined here, as for the pictures: ofetch leaves a relative path as it is
 * when the base is `/`, and the browser would resolve it against the page's own address (/london/data/…).
 *
 * @param city - The city, by its id: the page's, which is mounted afresh for each.
 * @returns The network once fetched, and what went wrong, if anything.
 */
export const useCityNetwork = (city: string): { network: Ref<Network | undefined>; error: Ref<Error | undefined> } => {
  const baseURL = useRuntimeConfig().app.baseURL;
  const { data, error } = useFetch(() => `${baseURL}${networkUrlOf(city)}`, { server: false, transform: servedNetwork });
  return { network: data, error };
};
