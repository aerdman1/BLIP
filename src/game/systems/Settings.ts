/**
 * Persistent player settings (localStorage blip_settings_v1):
 * sound volume/mute, CRT overlay, screen shake. Emits EVT.settingsChanged.
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
  shake: boolean;
  filter: FilterId; // screen filter on the title screen ('none' = off)
  touchControls: TouchControlsMode; // on-screen D-pad + buttons for tablets
}

const DEFAULTS: BlipSettings = { muted: false, volume: 0.35, music: true, musicVolume: 0.6, crt: true, shake: true, filter: 'none', touchControls: 'auto' };

function load(): BlipSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<BlipSettings>) };
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
