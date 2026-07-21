import { expect, test, type Page } from '@playwright/test';
import { api, bootToMenu, startGame, watchConsole } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';

type PersonaName = 'new-player' | 'casual' | 'aggressive' | 'explorer' | 'skilled-action' | 'unpredictable';

interface Persona {
  name: PersonaName;
  reactionMs: number;
  aimError: number;
  curiosity: number;
  aggression: number;
  riskTolerance: number;
  exploration: number;
  weaponPreference: string[];
  abilityUse: number;
  objectiveUnderstanding: number;
  missInstructionChance: number;
  mistakeChance: number;
}

interface RunResult {
  persona: PersonaName;
  seed: number;
  result: 'completed' | 'alive-timeout' | 'death' | 'soft-lock-risk';
  durationMs: number;
  regionsReached: string[];
  regionsCompleted: string[];
  deaths: number;
  stuckEvents: number;
  objectiveFailures: number;
  boredomFlags: string[];
  frustrationFlags: string[];
  weaponUsage: Record<string, number>;
  weaponSwitches: number;
  phaseShiftUses: number;
  secretsFound: number;
  lootSeen: number;
  lootIgnored: number;
  lootCollected: number;
  damageEvents: number;
  timeWithoutProgressMs: number;
  screenshots: string[];
}

const PERSONAS: Persona[] = [
  { name: 'new-player', reactionMs: 360, aimError: 0.55, curiosity: 0.45, aggression: 0.35, riskTolerance: 0.25, exploration: 0.5, weaponPreference: ['pulse'], abilityUse: 0.2, objectiveUnderstanding: 0.45, missInstructionChance: 0.45, mistakeChance: 0.35 },
  { name: 'casual', reactionMs: 240, aimError: 0.32, curiosity: 0.55, aggression: 0.48, riskTolerance: 0.42, exploration: 0.48, weaponPreference: ['pulse', 'disc'], abilityUse: 0.38, objectiveUnderstanding: 0.65, missInstructionChance: 0.22, mistakeChance: 0.18 },
  { name: 'aggressive', reactionMs: 130, aimError: 0.22, curiosity: 0.18, aggression: 0.9, riskTolerance: 0.82, exploration: 0.18, weaponPreference: ['arc', 'pulse'], abilityUse: 0.75, objectiveUnderstanding: 0.7, missInstructionChance: 0.12, mistakeChance: 0.14 },
  { name: 'explorer', reactionMs: 260, aimError: 0.35, curiosity: 0.92, aggression: 0.32, riskTolerance: 0.38, exploration: 0.9, weaponPreference: ['disc', 'pulse'], abilityUse: 0.45, objectiveUnderstanding: 0.58, missInstructionChance: 0.18, mistakeChance: 0.16 },
  { name: 'skilled-action', reactionMs: 90, aimError: 0.14, curiosity: 0.45, aggression: 0.76, riskTolerance: 0.7, exploration: 0.35, weaponPreference: ['pulse', 'arc', 'disc'], abilityUse: 0.86, objectiveUnderstanding: 0.86, missInstructionChance: 0.04, mistakeChance: 0.06 },
  { name: 'unpredictable', reactionMs: 190, aimError: 0.42, curiosity: 0.72, aggression: 0.56, riskTolerance: 0.6, exploration: 0.7, weaponPreference: ['pulse', 'arc', 'disc'], abilityUse: 0.62, objectiveUnderstanding: 0.42, missInstructionChance: 0.32, mistakeChance: 0.42 },
];

const SEED_COUNT = Math.max(1, Number(process.env.AI_LAB_SEED_COUNT ?? 2));
const SEED_BASE = Number(process.env.AI_LAB_SEED_BASE ?? 3107);
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => (SEED_BASE + i * 6007) % 99991);
const RUN_MS = Number(process.env.AI_LAB_RUN_MS ?? 4200);

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function sign(v: number): -1 | 0 | 1 {
  if (v < -0.18) return -1;
  if (v > 0.18) return 1;
  return 0;
}

function vecTo(from: { x: number; y: number }, to: { x: number; y: number }, error: number, rand: () => number): { x: number; y: number } {
  const a = Math.atan2(to.y - from.y, to.x - from.x) + (rand() - 0.5) * error;
  return { x: Math.cos(a), y: Math.sin(a) };
}

async function runPersona(page: Page, persona: Persona, seed: number): Promise<RunResult> {
  const rand = rng(seed);
  await bootToMenu(page);
  await startGame(page);
  await api(page, 'api.stopAi()');
  const screenshots: string[] = [];
  const shotDir = `test-results/ai-player-lab/screenshots`;
  mkdirSync(shotDir, { recursive: true });
  const started = Date.now();
  let nextDecision = 0;
  let lastProgressAt = Date.now();
  let lastPos = { x: 0, y: 0 };
  let lastHp = 0;
  let lastRegion = '';
  let previousRegion = '';
  let lastEnemies = -1;
  let lastNode = -1;
  let weaponSwitches = 0;
  let phaseShiftUses = 0;
  let damageEvents = 0;
  let stuckEvents = 0;
  let objectiveFailures = 0;
  let lootSeen = 0;
  let lootCollected = 0;
  let lastLootSeen = new Set<string>();
  const regionsReached: string[] = [];
  const regionsCompleted = new Set<string>();
  const weaponUsage: Record<string, number> = {};
  const boredomFlags: string[] = [];
  const frustrationFlags: string[] = [];
  let result: RunResult['result'] = 'alive-timeout';

  const entryShot = `${shotDir}/${persona.name}-${seed}-entry.png`;
  await page.screenshot({ path: entryShot });
  screenshots.push(entryShot);

  while (Date.now() - started < RUN_MS) {
    const perception = await api<any>(page, 'api.getAiPerception()');
    const scene = await api<string>(page, 'api.getSceneName()');
    if (scene === 'GameOverScene') {
      result = 'death';
      break;
    }
    if (!perception?.player) break;
    const now = Date.now();
    const region = perception.arena.id as string;
    if (!regionsReached.includes(region)) regionsReached.push(region);
    if (lastRegion && lastRegion !== region) regionsCompleted.add(lastRegion);
    previousRegion = lastRegion;
    lastRegion = region;

    weaponUsage[perception.weapon.id] = (weaponUsage[perception.weapon.id] ?? 0) + 1;
    if (lastHp && perception.player.hp < lastHp) damageEvents++;
    lastHp = perception.player.hp;

    const lootKeys = new Set<string>((perception.visible.pickups ?? []).map((p: any) => `${p.type}:${p.weapon}:${p.x}:${p.y}`));
    for (const k of lootKeys) if (!lastLootSeen.has(k)) lootSeen++;
    const previousLootSize = lastLootSeen.size;
    if (lootKeys.size < lastLootSeen.size) lootCollected++;

    const progressChanged =
      perception.progress.node !== lastNode ||
      perception.progress.enemiesActive !== lastEnemies ||
      region !== previousRegion ||
      lootKeys.size !== previousLootSize;
    if (progressChanged) lastProgressAt = now;
    lastNode = perception.progress.node;
    lastEnemies = perception.progress.enemiesActive;
    lastLootSeen = lootKeys;

    const moved = Math.hypot(perception.player.x - lastPos.x, perception.player.y - lastPos.y);
    if (lastPos.x && moved < 2 && now - nextDecision > persona.reactionMs && (perception.visible.enemies.length || perception.progress.breachOpen)) {
      if (rand() < 0.2) stuckEvents++;
    }
    lastPos = { x: perception.player.x, y: perception.player.y };

    if (now - lastProgressAt > 2600 && !boredomFlags.includes('no-progress-window')) boredomFlags.push('no-progress-window');
    if (now - lastProgressAt > 3600) objectiveFailures++;

    if (screenshots.length < 3 && perception.visible.enemies.length >= 3) {
      const heavy = `${shotDir}/${persona.name}-${seed}-combat.png`;
      await page.screenshot({ path: heavy });
      screenshots.push(heavy);
    }

    if (now >= nextDecision) {
      nextDecision = now + persona.reactionMs + Math.round(rand() * 80);
      const player = perception.player;
      const enemies = perception.visible.enemies as Array<{ x: number; y: number; distance: number }>;
      const pickups = perception.visible.pickups as Array<{ x: number; y: number; type: string; weapon: string; distance: number }>;
      const visibleBreach = perception.visible.breach as ({ x: number; y: number; open: boolean; distance: number } | null);
      const visibleNode = perception.visible.node as ({ x: number; y: number; distance: number } | null);
      const objectiveHint = perception.objectiveHint as ({ x: number; y: number; distance: number; kind: string } | null);

      let target: { x: number; y: number } | null = null;
      let fire = false;
      let dashQueued = false;
      let scanQueued = false;
      let weaponSlotQueued: 0 | 1 | 2 | null = null;
      let weaponNextQueued = false;

      const preferred = persona.weaponPreference[Math.floor(rand() * persona.weaponPreference.length)];
      if (rand() < 0.08 + persona.mistakeChance * 0.12) weaponNextQueued = true;
      if (preferred === 'arc' && perception.weapon.id !== 'arc' && enemies[0]?.distance < 72) weaponSlotQueued = 1;
      if (preferred === 'disc' && perception.weapon.id !== 'disc' && enemies[0]?.distance > 100) weaponSlotQueued = 2;
      if (weaponNextQueued || weaponSlotQueued !== null) weaponSwitches++;

      const usefulPickup = pickups.find((p) => p.type === 'health' && player.hp <= 3) ?? pickups.find((p) => p.type === 'weapon' && (persona.curiosity + rand() * 0.4) > 0.62);
      if (usefulPickup && rand() > persona.missInstructionChance) {
        target = usefulPickup;
      } else if (enemies.length) {
        const enemy = enemies[0];
        const keepAway = persona.riskTolerance < 0.45 && enemy.distance < 80;
        const strafe = persona.name === 'skilled-action' || persona.name === 'unpredictable';
        target = keepAway
          ? { x: player.x - (enemy.x - player.x), y: player.y - (enemy.y - player.y) }
          : strafe
            ? { x: player.x - (enemy.y - player.y), y: player.y + (enemy.x - player.x) }
            : enemy;
        fire = rand() > persona.mistakeChance * 0.7;
        if (rand() < persona.abilityUse * 0.18 && enemy.distance < 105) { dashQueued = true; phaseShiftUses++; }
      } else if (visibleBreach?.open && rand() < persona.objectiveUnderstanding) {
        target = visibleBreach;
      } else if (visibleNode && rand() < persona.objectiveUnderstanding) {
        target = visibleNode;
      } else if (objectiveHint && rand() < persona.objectiveUnderstanding * 0.72) {
        target = objectiveHint;
      } else {
        const angle = (rand() * Math.PI * 2) + (persona.exploration * 0.7);
        target = { x: player.x + Math.cos(angle) * 90, y: player.y + Math.sin(angle) * 90 };
      }

      if (rand() < persona.curiosity * 0.13) scanQueued = true;
      const aimTarget = enemies[0] ?? target ?? { x: player.x + 1, y: player.y };
      const aim = vecTo(player, aimTarget, persona.aimError, rand);
      const move = target ? vecTo(player, target, persona.mistakeChance * 0.8, rand) : { x: 0, y: 0 };
      await api(page, `api.driveAi(${JSON.stringify({
        moveX: sign(move.x),
        moveY: sign(move.y),
        aimX: aim.x,
        aimY: aim.y,
        fire,
        dashQueued,
        scanQueued,
        weaponNextQueued,
        weaponSlotQueued,
      })})`);
    }
    await page.waitForTimeout(100);
  }

  await api(page, 'api.stopAi()');
  const save = await api<any>(page, 'api.getSaveData()');
  for (const z of save.completedZones ?? []) regionsCompleted.add(z);
  if ((save.completedZones ?? []).includes('skyline-array')) result = 'completed';
  if (stuckEvents >= 3 && result === 'alive-timeout') result = 'soft-lock-risk';
  if (damageEvents >= 3) frustrationFlags.push('heavy-damage');
  if (stuckEvents) frustrationFlags.push('stuck-against-geometry');
  if ((weaponUsage.pulse ?? 0) > ((weaponUsage.arc ?? 0) + (weaponUsage.disc ?? 0)) * 4) boredomFlags.push('pulse-dominates');
  const elapsed = Date.now() - started;
  return {
    persona: persona.name,
    seed,
    result,
    durationMs: elapsed,
    regionsReached,
    regionsCompleted: [...regionsCompleted],
    deaths: result === 'death' ? 1 : 0,
    stuckEvents,
    objectiveFailures,
    boredomFlags,
    frustrationFlags,
    weaponUsage,
    weaponSwitches,
    phaseShiftUses,
    secretsFound: (save.foundSecrets ?? []).length,
    lootSeen,
    lootIgnored: Math.max(0, lootSeen - lootCollected),
    lootCollected,
    damageEvents,
    timeWithoutProgressMs: Math.max(0, Date.now() - lastProgressAt),
    screenshots,
  };
}

function summarize(runs: RunResult[]) {
  const personas = Object.fromEntries(PERSONAS.map((p) => {
    const mine = runs.filter((r) => r.persona === p.name);
    return [p.name, {
      completionRate: mine.filter((r) => r.result === 'completed').length / Math.max(1, mine.length),
      averageDeaths: mine.reduce((a, r) => a + r.deaths, 0) / Math.max(1, mine.length),
      averageStuckEvents: mine.reduce((a, r) => a + r.stuckEvents, 0) / Math.max(1, mine.length),
    }];
  }));
  const weaponTotals: Record<string, number> = {};
  const stuckAreas: Record<string, number> = {};
  for (const r of runs) {
    for (const [k, v] of Object.entries(r.weaponUsage)) weaponTotals[k] = (weaponTotals[k] ?? 0) + v;
    if (r.stuckEvents) stuckAreas[r.regionsReached.at(-1) ?? 'unknown'] = (stuckAreas[r.regionsReached.at(-1) ?? 'unknown'] ?? 0) + r.stuckEvents;
  }
  const leastUsedWeapon = Object.entries({ pulse: 0, arc: 0, disc: 0, ...weaponTotals }).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'unknown';
  const flags = runs.flatMap((r) => [...r.boredomFlags, ...r.frustrationFlags]);
  return {
    completionRate: runs.filter((r) => r.result === 'completed').length / Math.max(1, runs.length),
    personas,
    leastUsedWeapon,
    mostCommonStuckAreas: stuckAreas,
    mostIgnoredRewards: runs.reduce((a, r) => a + r.lootIgnored, 0),
    mostConfusingObjective: runs.reduce((a, r) => a + r.objectiveFailures, 0) > runs.length / 2 ? 'first Signal Node / route-forwarding' : 'none flagged',
    mostRepetitiveEncounter: runs.filter((r) => r.boredomFlags.includes('pulse-dominates')).length > runs.length / 3 ? 'holding basic fire dominates early combat' : 'none flagged',
    likelyBoredomFlags: [...new Set(flags.filter((f) => /progress|pulse/.test(f)))],
    likelyFrustrationFlags: [...new Set(flags.filter((f) => /damage|stuck/.test(f)))],
  };
}

test('AI Player Lab personas produce repeatable vertical-slice evidence', async ({ page }) => {
  test.setTimeout(Math.max(120_000, PERSONAS.length * SEEDS.length * (RUN_MS + 2300)));
  const watcher = watchConsole(page);
  const runs: RunResult[] = [];
  for (const seed of SEEDS) {
    for (const persona of PERSONAS) runs.push(await runPersona(page, persona, seed));
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    label: process.env.AI_LAB_LABEL ?? 'current',
    runMs: RUN_MS,
    seeds: SEEDS,
    guardrails: [
      'Personas use visible-perception snapshots only: player, HUD progress, visible enemies, visible pickups, visible node/breach.',
      'No hidden cache positions, full map geometry, enemy timers, future objectives or direct route-completion hooks are used.',
      'Metrics are warning signals, not proof that the game is fun.',
    ],
    runs,
    summary: summarize(runs),
  };
  mkdirSync('test-results/ai-player-lab', { recursive: true });
  mkdirSync('public/ai-playtest', { recursive: true });
  writeFileSync('test-results/ai-player-lab/latest.json', JSON.stringify(report, null, 2));
  writeFileSync('public/ai-playtest/latest.json', JSON.stringify(report, null, 2));
  expect(watcher.errors, watcher.errors.join(' | ')).toHaveLength(0);
  expect(runs.length).toBe(PERSONAS.length * SEEDS.length);
  expect(runs.some((r) => r.regionsReached.length > 0)).toBe(true);
});
