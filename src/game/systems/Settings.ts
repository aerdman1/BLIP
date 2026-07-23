/**
 * Persistent player settings (localStorage blip_settings_v1):
 * sound volume/mute, CRT overlay, screen filters, player aura, screen shake. Emits EVT.settingsChanged.
 */
import { EVT, SETTINGS_KEY, type FilterId } from '../config';
import { bus } from './EventBus';

/** On-screen touch controls: auto (show on touch devices), always on, or off. */
export type TouchControlsMode = 'auto' | 'on' | 'off';

export interface BlipSettings {
  muted: boolean;
  volume: number; // 0..1 (master)
  music: boolean; // background music on/off
  musicVolume: number; // 0..1 (relative music level under master)
  crt: boolean;
  playerAura: boolean;
  shake: boolean;
  filter: FilterId; // screen filter for title and gameplay world cameras ('none' = off)
  filterIntensity: number; // 0..1 multiplier for the active screen filter
  touchControls: TouchControlsMode; // on-screen D-pad + buttons for tablets
}

const DEFAULTS: BlipSettings = {
  muted: false,
  volume: 0.35,
  music: true,
  musicVolume: 0.6,
  crt: false,
  playerAura: false,
  shake: true,
  filter: 'none',
  filterIntensity: 1,
  touchControls: 'auto',
};

const CRT_DEFAULT_OFF_MIGRATION_KEY = `${SETTINGS_KEY}:crt-default-off-v1`;

function load(): BlipSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BlipSettings>;
      const migrated = { ...DEFAULTS, ...parsed };
      if (!localStorage.getItem(CRT_DEFAULT_OFF_MIGRATION_KEY)) {
        migrated.crt = false;
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
          localStorage.setItem(CRT_DEFAULT_OFF_MIGRATION_KEY, '1');
        } catch { /* private mode */ }
      }
      return migrated;
    }
  } catch {
    /* defaults */
  }
  return { ...DEFAULTS };
}

class SettingsStore {
  private state: BlipSettings = load();

  get all(): BlipSettings {
    return { ...this.state };
  }

  get<K extends keyof BlipSettings>(key: K): BlipSettings[K] {
    return this.state[key];
  }

  set<K extends keyof BlipSettings>(key: K, value: BlipSettings[K]): void {
    if (this.state[key] === value) return;
    this.state[key] = value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.state));
    } catch {
      /* private mode */
    }
    bus.emit(EVT.settingsChanged, { key, value, all: this.all });
  }
}

export const settings = new SettingsStore();
