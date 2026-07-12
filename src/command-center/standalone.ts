/**
 * Standalone Command Center — /command-center.html
 * The full dev dashboard in its own tab, WITHOUT the game (no Phaser in this
 * bundle). Save data, scouts, progression and QA status all read live from
 * the same localStorage; only in-session telemetry (current scene/objective)
 * is offline here.
 */
import '../style.css'; // palette vars + typography shared with the game shell
import { CommandCenter } from './CommandCenter';

const root = document.getElementById('command-center') as HTMLElement;
const cc = new CommandCenter(root, { standalone: true });
cc.open();
