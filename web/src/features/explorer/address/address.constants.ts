import { COVERAGE_DEFAULT_METRES, COVERAGE_DISTANCES } from '@railtime/network/coverage.constants';
import type { AddressSetting, ExplorerSettings } from '~/features/explorer/address/address.types';
import { CAMERA_OPTIONS, DEFAULT_PLAYER, SPEED_OPTIONS } from '~/features/explorer/time/time.constants';

/**
 * The least time between two writes of the address, ms. Playing, the playhead moves every frame, and a
 * browser refuses a page that rewrites its address that often (Safari: 100 times in 30 s); the last
 * one is always written, while the page is there to write it.
 */
export const ADDRESS_WRITE_MS = 500;

/** Each setting of a page as the address holds it: the one place its parameter, its values and its default are said. */
export const ADDRESS_SETTINGS: { [Key in keyof ExplorerSettings]: AddressSetting<ExplorerSettings[Key]> } = {
  walk: { param: 'walk', fallback: COVERAGE_DEFAULT_METRES, offered: COVERAGE_DISTANCES.map(metres => [String(metres), metres]) },
  viewMode: { param: 'view', fallback: '2d', offered: [['3d', '3d']] },
  stationNames: { param: 'names', fallback: true, offered: [['off', false]] },
  streetNames: { param: 'streets', fallback: true, offered: [['off', false]] },
  trains: { param: 'trains', fallback: false, offered: [['on', true]] },
  mapOnly: { param: 'mapOnly', fallback: false, offered: [['1', true]] },
  panelOpen: { param: 'panel', fallback: true, offered: [['off', false]] },
  speed: { param: 'speed', fallback: DEFAULT_PLAYER.speed, offered: SPEED_OPTIONS.map(option => [String(option.value), option.value]) },
  camera: { param: 'camera', fallback: DEFAULT_PLAYER.camera, offered: CAMERA_OPTIONS.map(option => [option.value, option.value]) },
  minimap: { param: 'minimap', fallback: DEFAULT_PLAYER.minimap, offered: [['off', false]] },
};
