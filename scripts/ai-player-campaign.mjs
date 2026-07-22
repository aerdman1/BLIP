#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'test-results/ai-player-lab');
const PUB_DIR = path.join(ROOT, 'public/ai-playtest');
const SHOT_DIR = path.join(OUT_DIR, 'campaign-screenshots');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PUB_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });

const RUNS = Number(process.env.AI_CAMPAIGN_RUNS ?? 500);
const RUN_MS = Number(process.env.AI_CAMPAIGN_RUN_MS ?? 11000);
const DEFAULT_PORT = Number(process.env.AI_CAMPAIGN_PORT ?? (4173 + (process.pid % 400)));
const BASE_URL = process.env.AI_CAMPAIGN_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`;
const PORT = Number(new URL(BASE_URL).port || 4173);
const LABEL = process.env.AI_CAMPAIGN_LABEL ?? process.env.AI_CAMPAIGN_REPORT ?? 'campaign';
const RESTART_EVERY = Number(process.env.AI_CAMPAIGN_RESTART_EVERY ?? 40);
const SAVE_EVERY = Number(process.env.AI_CAMPAIGN_SAVE_EVERY ?? (RUNS <= 30 ? 1 : 10));
const VISIBLE_EVERY = Number(process.env.AI_CAMPAIGN_VISIBLE_EVERY ?? 35);
const NO_BUILD = process.env.AI_CAMPAIGN_NO_BUILD === '1';
const NO_SERVER = process.env.AI_CAMPAIGN_NO_SERVER === '1';
const SCENARIO_FILTER = (process.env.AI_CAMPAIGN_SCENARIOS ?? process.env.AI_CAMPAIGN_SCENARIO ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PERSONAS = [
  { name: 'new-player', reactionMs: 360, aimError: 0.55, curiosity: 0.45, aggression: 0.35, riskTolerance: 0.25, exploration: 0.5, weaponPreference: ['pulse'], abilityUse: 0.2, objectiveUnderstanding: 0.45, missInstructionChance: 0.45, mistakeChance: 0.35 },
  { name: 'casual', reactionMs: 240, aimError: 0.32, curiosity: 0.55, aggression: 0.48, riskTolerance: 0.42, exploration: 0.48, weaponPreference: ['pulse', 'disc'], abilityUse: 0.38, objectiveUnderstanding: 0.65, missInstructionChance: 0.22, mistakeChance: 0.18 },
  { name: 'aggressive', reactionMs: 130, aimError: 0.22, curiosity: 0.18, aggression: 0.9, riskTolerance: 0.82, exploration: 0.18, weaponPreference: ['arc', 'pulse'], abilityUse: 0.75, objectiveUnderstanding: 0.7, missInstructionChance: 0.12, mistakeChance: 0.14 },
  { name: 'explorer', reactionMs: 260, aimError: 0.35, curiosity: 0.92, aggression: 0.32, riskTolerance: 0.38, exploration: 0.9, weaponPreference: ['disc', 'pulse'], abilityUse: 0.45, objectiveUnderstanding: 0.58, missInstructionChance: 0.18, mistakeChance: 0.16 },
  { name: 'skilled-action', reactionMs: 90, aimError: 0.14, curiosity: 0.45, aggression: 0.76, riskTolerance: 0.7, exploration: 0.35, weaponPreference: ['pulse', 'arc', 'disc'], abilityUse: 0.86, objectiveUnderstanding: 0.86, missInstructionChance: 0.04, mistakeChance: 0.06 },
  { name: 'unpredictable', reactionMs: 190, aimError: 0.42, curiosity: 0.72, aggression: 0.56, riskTolerance: 0.6, exploration: 0.7, weaponPreference: ['pulse', 'arc', 'disc'], abilityUse: 0.62, objectiveUnderstanding: 0.42, missInstructionChance: 0.32, mistakeChance: 0.42 },
];

const SCENARIOS = [
  { name: 'full-route', zone: 'miller-field', goalZone: 'skyline-array', runMul: 8.5, objectiveBias: 1.25 },
  { name: 'route-miller-motel', zone: 'miller-field', goalZone: 'motel-nowhere', runMul: 3.4, objectiveBias: 1.35, arrivalGoal: true },
  { name: 'route-first-three', zone: 'miller-field', goalZone: 'tiger-stadium', runMul: 7.2, objectiveBias: 1.35, arrivalGoal: true },
  { name: 'region-miller', zone: 'miller-field', goalZone: 'miller-field', runMul: 1.75, objectiveBias: 1.05 },
  { name: 'region-motel', zone: 'motel-nowhere', goalZone: 'motel-nowhere', runMul: 1.8, objectiveBias: 1.1 },
  { name: 'region-town', zone: 'tiger-stadium', goalZone: 'tiger-stadium', runMul: 1.8, objectiveBias: 1.1 },
  { name: 'region-orchard', zone: 'pattersons-orchard', goalZone: 'pattersons-orchard', runMul: 2.15, objectiveBias: 1.18 },
  { name: 'combat-storm', zone: 'skyline-array', goalZone: 'skyline-array', runMul: 1.8, objectiveBias: 0.85 },
  { name: 'objective-drill', zone: 'miller-field', goalZone: 'miller-field', runMul: 1.95, objectiveBias: 1.45 },
  { name: 'visible-review', zone: 'tiger-stadium', goalZone: 'tiger-stadium', runMul: 2.0, objectiveBias: 1.1, visual: true },
].filter((s) => SCENARIO_FILTER.length === 0 || SCENARIO_FILTER.includes(s.name));
if (!SCENARIOS.length) {
  throw new Error(`No AI campaign scenarios matched AI_CAMPAIGN_SCENARIOS=${process.env.AI_CAMPAIGN_SCENARIOS}`);
}

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sign = (v) => (v < -0.18 ? -1 : v > 0.18 ? 1 : 0);
function vecTo(from, to, error, rand) {
  const a = Math.atan2(to.y - from.y, to.x - from.x) + (rand() - 0.5) * error;
  return { x: Math.cos(a), y: Math.sin(a) };
}
function seenCachesNearby(perception) {
  return (perception.visible?.caches ?? []).some((c) => c.distance < 170);
}
async function api(page, expr) {
  return page.evaluate(`(() => { const api = window.__BLIP_TEST_API__; return (${expr}); })()`);
}
async function waitForApi(page) {
  await page.waitForFunction(() => !!window.__BLIP_TEST_API__?.getSceneName, { timeout: 20_000 });
}
async function resetToZone(page, zone) {
  await page.goto(`${BASE_URL}/?test=1`);
  await waitForApi(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForApi(page);
  await page.waitForFunction(() => window.__BLIP_TEST_API__.getSceneName() === 'MainMenuScene', { timeout: 20_000 });
  await api(page, `api.enterZone('${zone}')`);
  await page.waitForFunction(() => window.__BLIP_TEST_API__.getSceneName() === 'SweepScene', { timeout: 20_000 });
  await page.waitForFunction(() => document.getElementById('menu-overlay')?.classList.contains('hidden') === true, { timeout: 10_000 });
  await sleep(450);
}

async function runOne(page, idx) {
  const persona = PERSONAS[idx % PERSONAS.length];
  const scenario = SCENARIOS[Math.floor(idx / PERSONAS.length) % SCENARIOS.length];
  const seed = (3107 + idx * 6007) % 99991;
  const rand = rng(seed);
  const runMs = Math.round(RUN_MS * scenario.runMul * (0.82 + rand() * 0.36));
  const visual = scenario.visual || idx % VISIBLE_EVERY === 0;
  const started = Date.now();
  const consoleErrors = [];
  const screenshots = [];

  page.removeAllListeners('console');
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/GPU|SwiftShader|WebGL.*fallback/i.test(msg.text())) consoleErrors.push(msg.text());
  });
  await resetToZone(page, scenario.zone);
  const menuOverlayVisible = await page.evaluate(() => document.getElementById('menu-overlay')?.classList.contains('hidden') !== true);
  await api(page, 'api.stopAi()');
  if (visual) {
    const p = path.join(SHOT_DIR, `${String(idx + 1).padStart(4, '0')}-${persona.name}-${scenario.name}-entry.png`);
    await page.screenshot({ path: p });
    screenshots.push(path.relative(ROOT, p));
  }

  let nextDecision = 0;
  let lastProgressAt = Date.now();
  let lastPos = null;
  let lowMoveSince = 0;
  let lastObjectiveFailureAt = 0;
  let lastCommandMoving = false;
  let lastHp = 0;
  let lastRegion = '';
  let lastEnemies = -1;
  let lastNode = -1;
  let lastLootSize = 0;
  let maxNode = 0;
  let maxObjectiveActions = 0;
  let objectiveActionsRequired = 0;
  let gravityWellRequired = false;
  let gravityWellUsed = false;
  let breachOpened = false;
  let wallFollowUntil = 0;
  let wallFollowSide = 1;
  let stuckEvents = 0;
  let objectiveFailures = 0;
  let damageEvents = 0;
  let weaponSwitches = 0;
  let phaseShiftUses = 0;
  let lootSeen = 0;
  let lootCollected = 0;
  let lastLootSeen = new Set();
  const regionsReached = [];
  const regionsCompleted = new Set();
  const weaponUsage = {};
  const boredomFlags = [];
  const frustrationFlags = [];
  const decisionTrace = [];
  const stallSamples = [];
  let result = 'alive-timeout';
  let combatShotTaken = false;
  let lastDecisionKey = '';

  const recordDecision = (entry) => {
    const key = `${entry.region}:${entry.reason}:${entry.targetKind ?? ''}:${entry.targetLabel ?? ''}:${entry.breachOpen ? 1 : 0}`;
    if (key === lastDecisionKey && decisionTrace.length) return;
    lastDecisionKey = key;
    decisionTrace.push(entry);
    if (decisionTrace.length > 50) decisionTrace.shift();
  };

  while (Date.now() - started < runMs) {
    const scene = await api(page, 'api.getSceneName()');
    if (scene === 'GameOverScene') { result = 'death'; break; }
    const perception = await api(page, 'api.getAiPerception()');
    if (!perception?.player) { result = 'soft-lock-risk'; break; }
    const now = Date.now();
    const region = perception.arena.id;
    if (!regionsReached.includes(region)) regionsReached.push(region);
    if (lastRegion && lastRegion !== region) regionsCompleted.add(lastRegion);
    const previousRegion = lastRegion;
    lastRegion = region;
    weaponUsage[perception.weapon.id] = (weaponUsage[perception.weapon.id] ?? 0) + 1;
    if (lastHp && perception.player.hp < lastHp) damageEvents++;
    lastHp = perception.player.hp;
    maxNode = Math.max(maxNode, perception.progress.node ?? 0);
    maxObjectiveActions = Math.max(maxObjectiveActions, perception.progress.objectiveActions ?? 0);
    objectiveActionsRequired = Math.max(objectiveActionsRequired, perception.progress.objectiveActionsRequired ?? 0);
    gravityWellRequired = gravityWellRequired || perception.progress.gravityWellRequired === true;
    gravityWellUsed = gravityWellUsed || perception.progress.gravityWellUsed === true;
    breachOpened = breachOpened || perception.progress.breachOpen === true;

    const lootKeys = new Set((perception.visible.pickups ?? []).map((p) => `${p.type}:${p.weapon}:${p.x}:${p.y}`));
    for (const k of lootKeys) if (!lastLootSeen.has(k)) lootSeen++;
    if (lootKeys.size < lastLootSize) lootCollected++;
    const progressChanged = perception.progress.node !== lastNode || perception.progress.enemiesActive !== lastEnemies || region !== previousRegion || lootKeys.size !== lastLootSize;
    if (progressChanged) lastProgressAt = now;
    lastNode = perception.progress.node;
    lastEnemies = perception.progress.enemiesActive;
    lastLootSize = lootKeys.size;
    lastLootSeen = lootKeys;

    if (lastPos) {
      const moved = Math.hypot(perception.player.x - lastPos.x, perception.player.y - lastPos.y);
      if (moved < 1.5 && lastCommandMoving && (perception.visible.enemies.length || perception.progress.breachOpen)) {
        if (!lowMoveSince) lowMoveSince = now;
        if (now - lowMoveSince > 1400) {
          stuckEvents++;
          stallSamples.push({
            atMs: now - started,
            region,
            x: Math.round(perception.player.x),
            y: Math.round(perception.player.y),
            objective: perception.objective?.title ?? '',
            hint: perception.objectiveHint
              ? {
                  kind: perception.objectiveHint.kind,
                  label: perception.objectiveHint.label ?? '',
                  distance: perception.objectiveHint.distance,
                }
              : null,
            enemies: perception.visible.enemies.length,
            breachOpen: perception.progress.breachOpen,
          });
          if (stallSamples.length > 16) stallSamples.shift();
          wallFollowUntil = now + 1800;
          wallFollowSide = rand() < 0.5 ? -1 : 1;
          lowMoveSince = now;
        }
      } else {
        lowMoveSince = 0;
      }
    }
    lastPos = { x: perception.player.x, y: perception.player.y };
    if (now - lastProgressAt > 3800 && !boredomFlags.includes('no-progress-window')) boredomFlags.push('no-progress-window');
    if (now - lastProgressAt > 6400 && now - lastObjectiveFailureAt > 3000) {
      objectiveFailures++;
      lastObjectiveFailureAt = now;
    }
    if (!scenario.arrivalGoal && scenario.name !== 'full-route' && breachOpened) {
      result = 'objective-complete';
      break;
    }
    if (scenario.arrivalGoal && perception.arena.zoneId === scenario.goalZone) {
      result = 'completed';
      break;
    }
    if (visual && !combatShotTaken && perception.visible.enemies.length >= 3) {
      combatShotTaken = true;
      const p = path.join(SHOT_DIR, `${String(idx + 1).padStart(4, '0')}-${persona.name}-${scenario.name}-combat.png`);
      await page.screenshot({ path: p });
      screenshots.push(path.relative(ROOT, p));
    }

    if (now >= nextDecision) {
      nextDecision = now + persona.reactionMs + Math.round(rand() * 80);
      const player = perception.player;
      const enemies = perception.visible.enemies ?? [];
      const pickups = perception.visible.pickups ?? [];
      const signals = perception.visible.signals ?? [];
      const scanners = perception.visible.scanners ?? [];
      const visibleBreach = perception.visible.breach;
      const visibleNode = perception.visible.node;
      const objectiveHint = perception.objectiveHint;
      let target = null;
      let targetReason = 'wander';
      let fire = false;
      let dashQueued = false;
      let scanQueued = false;
      let interactQueued = false;
      let weaponNextQueued = false;
      let weaponSlotQueued = null;

      const preferred = persona.weaponPreference[Math.floor(rand() * persona.weaponPreference.length)];
      const roleEnemy = enemies.find((e) => ['warden', 'splitter', 'turret'].includes(e.kind) && e.distance < 120);
      if (rand() < 0.06 + persona.mistakeChance * 0.1) weaponNextQueued = true;
      if (roleEnemy && perception.weapon.id !== 'arc' && persona.name !== 'new-player' && rand() < 0.72 + persona.aggression * 0.18) weaponSlotQueued = 1;
      else if (enemies[0]?.distance < 70 && perception.weapon.id !== 'arc' && persona.name !== 'new-player' && rand() < 0.72) weaponSlotQueued = 1;
      else if (enemies[0]?.distance > 128 && enemies[0]?.distance < 230 && perception.weapon.id !== 'disc' && rand() < 0.48 + persona.curiosity * 0.2) weaponSlotQueued = 2;
      else if (preferred === 'arc' && perception.weapon.id !== 'arc' && enemies[0]?.distance < 86) weaponSlotQueued = 1;
      else if (preferred === 'disc' && perception.weapon.id !== 'disc' && enemies[0]?.distance > 105) weaponSlotQueued = 2;
      if (weaponNextQueued || weaponSlotQueued !== null) weaponSwitches++;

      const routeOpen = perception.progress.breachOpen === true;
      const routeScenario = scenario.arrivalGoal || scenario.name === 'full-route';
      const usefulPickup = pickups.find((p) => p.type === 'health' && player.hp <= 3)
        ?? (!routeOpen && enemies.length === 0 ? pickups.find((p) => p.type === 'weapon' && p.distance < 180 && (persona.curiosity + rand() * 0.4) > 0.74) : undefined);
      const interestingSignal = signals.find((s) => s.reward === 'health' && player.hp <= 4)
        ?? (!routeOpen ? signals.find((s) => rand() < persona.curiosity * persona.exploration) : undefined);
      const routeOpenFollowChance = Math.max(
        persona.objectiveUnderstanding * scenario.objectiveBias,
        1 - persona.missInstructionChance * 0.65
      );
      const nearestEnemy = enemies[0] ?? null;
      const threatenedByEnemy = nearestEnemy && nearestEnemy.distance < (player.hp <= 2 ? 170 : persona.riskTolerance < 0.45 ? 135 : 112);
      const urgentThreat = nearestEnemy && nearestEnemy.distance < (player.hp <= 2 ? 105 : 74);
      const routeFocusPressure = routeScenario && objectiveHint && !routeOpen && !urgentThreat && enemies.length === 0
        && (objectiveFailures > 0 || rand() < Math.max(0.72, persona.objectiveUnderstanding * scenario.objectiveBias * 0.88));
      const requiredTraversal = objectiveHint?.kind === 'gravity-well';
      const gravityGateNeeded = perception.progress.gravityWellRequired === true && perception.progress.gravityWellUsed !== true;
      const scannerPressure = scanners.find((s) => !s.disabled && s.distance < 125);
      const shouldFightVisibleThreat = threatenedByEnemy && !(perception.progress.breachOpen && objectiveHint && objectiveHint.distance < 120 && rand() < routeOpenFollowChance);
      const combatMove = (enemy) => {
        const keepAway = persona.riskTolerance < 0.45 && enemy.distance < 92;
        const closeIn = persona.aggression > 0.72 && enemy.distance > 78 && perception.weapon.id === 'arc';
        const strafe = persona.name === 'skilled-action' || persona.name === 'unpredictable' || rand() < persona.aggression * 0.35;
        if (keepAway) return { x: player.x - (enemy.x - player.x), y: player.y - (enemy.y - player.y) };
        if (closeIn) return enemy;
        if (strafe) return { x: player.x - (enemy.y - player.y), y: player.y + (enemy.x - player.x) };
        return enemy;
      };
      const routeOpenCommitChance = perception.progress.breachOpen
        ? Math.max(routeOpenFollowChance, routeScenario ? 0.96 - persona.mistakeChance * 0.08 : 0.9 - persona.mistakeChance * 0.22)
        : routeOpenFollowChance;
      if (routeScenario && perception.progress.breachOpen && objectiveHint && !urgentThreat && enemies.length === 0) {
        target = objectiveHint;
        targetReason = 'commit-open-route';
      } else if (perception.progress.breachOpen && objectiveHint && rand() < routeOpenCommitChance) {
        target = objectiveHint;
        targetReason = 'follow-open-route';
        fire = enemies.length > 0 && rand() > persona.mistakeChance;
      } else if (routeFocusPressure) {
        target = objectiveHint;
        targetReason = 'route-objective-focus';
      } else if (gravityGateNeeded && objectiveHint && !urgentThreat && rand() < Math.max(0.88, persona.objectiveUnderstanding * scenario.objectiveBias)) {
        target = objectiveHint;
        targetReason = 'required-gravity-route';
        fire = enemies.length > 0 && rand() > persona.mistakeChance;
        if (objectiveHint.kind === 'gravity-well' && objectiveHint.distance < 120) interactQueued = true;
      } else if (requiredTraversal && objectiveHint && !urgentThreat && rand() < Math.max(0.72, persona.objectiveUnderstanding * scenario.objectiveBias)) {
        target = objectiveHint;
        targetReason = 'required-traversal';
        fire = enemies.length > 0 && rand() > persona.mistakeChance;
        if (objectiveHint.distance < 110) interactQueued = true;
      } else if (shouldFightVisibleThreat) {
        target = combatMove(nearestEnemy);
        targetReason = 'fight-threat';
        fire = rand() > persona.mistakeChance * 0.8;
        if (rand() < persona.abilityUse * (nearestEnemy.distance < 80 ? 0.34 : 0.16)) { dashQueued = true; phaseShiftUses++; }
      } else if (scannerPressure && rand() < persona.abilityUse * scenario.objectiveBias) {
        target = objectiveHint ?? scannerPressure;
        targetReason = 'phase-scanner';
        dashQueued = scannerPressure.distance < 92;
        if (dashQueued) phaseShiftUses++;
      } else if (usefulPickup && rand() > persona.missInstructionChance) {
        target = usefulPickup;
        targetReason = 'collect-pickup';
      } else if (interestingSignal && rand() > persona.missInstructionChance * 0.75) {
        target = interestingSignal;
        targetReason = 'inspect-signal';
        scanQueued = interestingSignal.trigger === 'scan' && interestingSignal.distance < 170;
      } else if (enemies.length) {
        const enemy = enemies[0];
        target = combatMove(enemy);
        targetReason = 'fight-visible-enemy';
        fire = rand() > persona.mistakeChance * 0.72;
        if (rand() < persona.abilityUse * 0.18 && enemy.distance < 110) { dashQueued = true; phaseShiftUses++; }
      } else if (visibleBreach?.open && rand() < routeOpenCommitChance) {
        target = visibleBreach;
        targetReason = 'enter-visible-breach';
      } else if (!routeOpen && !gravityGateNeeded && visibleNode && rand() < persona.objectiveUnderstanding * scenario.objectiveBias) {
        target = visibleNode;
        targetReason = 'work-visible-node';
      } else if (objectiveHint && rand() < persona.objectiveUnderstanding * scenario.objectiveBias * 0.78) {
        target = objectiveHint;
        targetReason = 'follow-objective-hint';
      } else {
        const angle = rand() * Math.PI * 2 + persona.exploration * 0.7;
        target = { x: player.x + Math.cos(angle) * 90, y: player.y + Math.sin(angle) * 90 };
        targetReason = 'explore';
      }

      if (rand() < persona.curiosity * 0.13) scanQueued = true;
      if ((seenCachesNearby(perception) || interestingSignal?.trigger === 'scan') && rand() < persona.curiosity * 0.42) scanQueued = true;
      if (objectiveHint?.kind === 'gravity-well' && objectiveHint.distance < 110 && rand() < Math.max(0.62, persona.objectiveUnderstanding * scenario.objectiveBias)) {
        interactQueued = true;
      }
      const aimTarget = enemies[0] ?? target ?? { x: player.x + 1, y: player.y };
      const aim = vecTo(player, aimTarget, persona.aimError, rand);
      const move = target ? vecTo(player, target, persona.mistakeChance * 0.8, rand) : { x: 0, y: 0 };
      recordDecision({
        atMs: now - started,
        region,
        reason: targetReason,
        targetKind: target?.kind ?? target?.type ?? '',
        targetLabel: target?.label ?? target?.weapon ?? '',
        targetDistance: target?.distance ?? Math.round(Math.hypot((target?.x ?? player.x) - player.x, (target?.y ?? player.y) - player.y)),
        objectiveTitle: perception.objective?.title ?? '',
        breachOpen: perception.progress.breachOpen,
        enemies: enemies.length,
      });
      const followingWall = target && now < wallFollowUntil;
      const adjustedMove = followingWall
        ? { x: move.x * 0.25 - move.y * wallFollowSide, y: move.y * 0.25 + move.x * wallFollowSide }
        : move;
      if (followingWall && rand() < persona.abilityUse * 0.22) { dashQueued = true; phaseShiftUses++; }
      const moveX = sign(adjustedMove.x);
      const moveY = sign(adjustedMove.y);
      lastCommandMoving = moveX !== 0 || moveY !== 0;
      await api(page, `api.driveAi(${JSON.stringify({ moveX, moveY, aimX: aim.x, aimY: aim.y, fire, dashQueued, scanQueued, interactQueued, weaponNextQueued, weaponSlotQueued })})`);
    }
    await sleep(100);
  }

  await api(page, 'api.stopAi()').catch(() => false);
  const save = await api(page, 'api.getSaveData()').catch(() => ({ completedZones: [], foundSecrets: [] }));
  for (const z of save.completedZones ?? []) regionsCompleted.add(z);
  if (scenario.arrivalGoal && save.currentZone === scenario.goalZone) result = 'completed';
  else if ((save.completedZones ?? []).includes(scenario.goalZone)) result = 'completed';
  else if (!scenario.arrivalGoal && scenario.name !== 'full-route' && breachOpened) result = 'objective-complete';
  const finalTimeWithoutProgressMs = Math.max(0, Date.now() - lastProgressAt);
  if (stuckEvents >= 4 && finalTimeWithoutProgressMs > 7000 && result === 'alive-timeout') result = 'soft-lock-risk';
  if (damageEvents >= 3) frustrationFlags.push('heavy-damage');
  if (stuckEvents) frustrationFlags.push('stuck-against-geometry');
  if ((weaponUsage.pulse ?? 0) > ((weaponUsage.arc ?? 0) + (weaponUsage.disc ?? 0)) * 4) boredomFlags.push('pulse-dominates');
  if (objectiveFailures > 0) boredomFlags.push('objective-stall');
  if (gravityWellRequired && maxNode >= 70 && !gravityWellUsed) boredomFlags.push('gravity-well-missed');
  return {
    index: idx + 1,
    persona: persona.name,
    scenario: scenario.name,
    seed,
    result,
    durationMs: Date.now() - started,
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
    maxNode,
    maxObjectiveActions,
    objectiveActionsRequired,
    gravityWellRequired,
    gravityWellUsed,
    breachOpened,
    lootSeen,
    lootIgnored: Math.max(0, lootSeen - lootCollected),
    lootCollected,
    damageEvents,
    timeWithoutProgressMs: finalTimeWithoutProgressMs,
    decisionTrace,
    stallSamples,
    screenshots,
    consoleErrors,
    menuOverlayVisible,
  };
}

function summarize(runs) {
  const byPersona = {};
  const byScenario = {};
  const weaponTotals = { pulse: 0, arc: 0, disc: 0 };
  const deathAreas = {};
  const stuckAreas = {};
  const success = (r) => r.result === 'completed' || r.result === 'objective-complete';
  for (const r of runs) {
    const p = byPersona[r.persona] ??= { runs: 0, completionRate: 0, averageDeaths: 0, averageStuckEvents: 0 };
    p.runs++;
    p.completionRate += success(r) ? 1 : 0;
    p.averageDeaths += r.deaths;
    p.averageStuckEvents += r.stuckEvents;
    const s = byScenario[r.scenario] ??= { runs: 0, completionRate: 0, softLockRisks: 0, averageObjectiveFailures: 0 };
    s.runs++;
    s.completionRate += success(r) ? 1 : 0;
    s.softLockRisks += r.result === 'soft-lock-risk' ? 1 : 0;
    s.averageObjectiveFailures += r.objectiveFailures;
    for (const [k, v] of Object.entries(r.weaponUsage)) weaponTotals[k] = (weaponTotals[k] ?? 0) + v;
    const last = r.regionsReached.at(-1) ?? 'unknown';
    if (r.deaths) deathAreas[last] = (deathAreas[last] ?? 0) + r.deaths;
    if (r.stuckEvents) stuckAreas[last] = (stuckAreas[last] ?? 0) + r.stuckEvents;
  }
  for (const p of Object.values(byPersona)) {
    p.completionRate /= Math.max(1, p.runs);
    p.averageDeaths /= Math.max(1, p.runs);
    p.averageStuckEvents /= Math.max(1, p.runs);
  }
  for (const s of Object.values(byScenario)) {
    s.completionRate /= Math.max(1, s.runs);
    s.averageObjectiveFailures /= Math.max(1, s.runs);
  }
  const flags = runs.flatMap((r) => [...r.boredomFlags, ...r.frustrationFlags]);
  const flagCounts = {};
  for (const f of flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  return {
    completionRate: runs.filter(success).length / Math.max(1, runs.length),
    fullRouteCompletionRate: runs.filter((r) => r.scenario === 'full-route' && r.result === 'completed').length / Math.max(1, runs.filter((r) => r.scenario === 'full-route').length),
    objectiveCompleteRate: runs.filter((r) => r.result === 'objective-complete').length / Math.max(1, runs.length),
    runs: runs.length,
    personas: byPersona,
    scenarios: byScenario,
    leastUsedWeapon: Object.entries(weaponTotals).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'unknown',
    weaponTotals,
    mostCommonDeathAreas: deathAreas,
    mostCommonStuckAreas: stuckAreas,
    mostIgnoredRewards: runs.reduce((a, r) => a + r.lootIgnored, 0),
    mostConfusingObjective: runs.reduce((a, r) => a + r.objectiveFailures, 0) > runs.length * 0.18 ? 'Signal Node / route-forwarding' : 'none flagged',
    mostRepetitiveEncounter: flagCounts['pulse-dominates'] > runs.length * 0.2 ? 'holding basic fire dominates too many runs' : 'none flagged',
    likelyBoredomFlags: Object.entries(flagCounts).filter(([k]) => /progress|pulse|objective/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`),
    likelyFrustrationFlags: Object.entries(flagCounts).filter(([k]) => /damage|stuck/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`),
  };
}

function buildReport(runs, startedAt, finishedAt, phase = LABEL) {
  return {
    schemaVersion: 1,
    generatedAt: finishedAt,
    startedAt,
    label: phase,
    runMs: RUN_MS,
    targetRuns: RUNS,
    seeds: runs.map((r) => r.seed),
    guardrails: [
      'Personas use visible-perception snapshots only: player, HUD progress, visible enemies, visible pickups, visible node/breach, and the same objective arrow visible to a human.',
      'No hidden cache positions, full map geometry, enemy timers, future objectives or direct route-completion hooks are used.',
      'The browser is reused for batches and restarted periodically to expose stale state and memory leaks.',
      'Metrics are warning signals, not proof that BLIP is fun.',
    ],
    runs,
    summary: summarize(runs),
    findings: rankFindings(runs),
  };
}

function rankFindings(runs) {
  const stuck = runs.filter((r) => r.result === 'soft-lock-risk' || r.stuckEvents > 0);
  const objective = runs.filter((r) => r.result !== 'completed' && r.result !== 'objective-complete' && (r.objectiveFailures > 0 || r.boredomFlags.includes('objective-stall')));
  const damage = runs.filter((r) => r.frustrationFlags.includes('heavy-damage'));
  const pulse = runs.filter((r) => r.boredomFlags.includes('pulse-dominates'));
  const ignoredLoot = runs.filter((r) => r.lootIgnored > 0);
  return [
    { rank: 1, category: 'Game-breaking or blocking issues', count: stuck.length, reliability: stuck.length > 5 ? 'reliable' : 'speculative', finding: stuck.length ? 'Some runs look stuck or soft-lock-prone; inspect mostCommonStuckAreas and screenshots.' : 'No repeated blocking issue detected.' },
    { rank: 2, category: 'Confusing or unfair gameplay', count: objective.length + damage.length, reliability: objective.length + damage.length > 10 ? 'reliable' : 'speculative', finding: objective.length ? 'Objective routing still stalls some personas.' : damage.length ? 'Damage spikes require review.' : 'No repeated clarity/fairness issue detected.' },
    { rank: 3, category: 'Repetitive or boring gameplay', count: pulse.length, reliability: pulse.length > 10 ? 'reliable' : 'speculative', finding: pulse.length ? 'Basic fire dominates too many runs.' : 'No repeated boredom signal detected.' },
    { rank: 4, category: 'Weapon and encounter balance', count: pulse.length, reliability: pulse.length > 10 ? 'reliable' : 'speculative', finding: pulse.length ? 'Encounters may need counters/rewards that invite Arc/Disc.' : 'Weapon use appears varied enough for this pass.' },
    { rank: 5, category: 'Reward and objective clarity', count: ignoredLoot.length, reliability: ignoredLoot.length > 10 ? 'reliable' : 'speculative', finding: ignoredLoot.length ? 'Visible rewards are being skipped by multiple runs.' : 'No repeated reward clarity issue detected.' },
    { rank: 6, category: 'Visual or polish improvements', count: runs.filter((r) => r.screenshots.length > 0).length, reliability: 'needs human/AI screenshot review', finding: 'Review representative screenshots for clutter, depth sorting, readable pickups and camera framing.' },
  ];
}

function writeReports(runs, startedAt, phase = LABEL) {
  const finishedAt = new Date().toISOString();
  const report = buildReport(runs, startedAt, finishedAt, phase);
  const latest = path.join(OUT_DIR, 'campaign-latest.json');
  const publicLatest = path.join(PUB_DIR, 'latest.json');
  writeFileSync(latest, JSON.stringify(report, null, 2));
  writeFileSync(publicLatest, JSON.stringify(report, null, 2));
  return report;
}

function startServer() {
  if (!NO_BUILD) {
    const built = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
    if (built.status !== 0) process.exit(built.status ?? 1);
  }
  if (NO_SERVER) return null;
  const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  return server;
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const previous = existsSync(path.join(PUB_DIR, 'latest.json')) ? JSON.parse(readFileSync(path.join(PUB_DIR, 'latest.json'), 'utf8')) : null;
  const server = startServer();
  await waitForServer();
  console.log(
    `[ai-campaign] label=${LABEL} runs=${RUNS} runMs=${RUN_MS} scenarios=${SCENARIOS.map((s) => s.name).join(',')} saveEvery=${SAVE_EVERY}`
  );
  let browser = await chromium.launch();
  let page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const runs = [];
  try {
    for (let i = 0; i < RUNS; i++) {
      if (i > 0 && i % RESTART_EVERY === 0) {
        await browser.close();
        browser = await chromium.launch();
        page = await browser.newPage({ viewport: { width: 960, height: 540 } });
      }
      const run = await runOne(page, i);
      runs.push(run);
      if ((i + 1) % SAVE_EVERY === 0 || i + 1 === RUNS) {
        const report = writeReports(runs, startedAt);
        const soft = runs.filter((r) => r.result === 'soft-lock-risk').length;
        const deaths = runs.filter((r) => r.deaths).length;
        console.log(`[ai-campaign] ${i + 1}/${RUNS} runs · completion ${(report.summary.completionRate * 100).toFixed(1)}% · soft ${soft} · deaths ${deaths} · least ${report.summary.leastUsedWeapon}`);
      }
    }
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    server?.kill('SIGTERM');
  }
  const report = writeReports(runs, startedAt);
  if (previous?.summary) {
    report.comparison = {
      previousLabel: previous.label,
      previousRuns: previous.runs?.length ?? 0,
      previousCompletionRate: previous.summary.completionRate,
      completionRateDelta: report.summary.completionRate - previous.summary.completionRate,
      previousLeastUsedWeapon: previous.summary.leastUsedWeapon,
      currentLeastUsedWeapon: report.summary.leastUsedWeapon,
    };
    writeFileSync(path.join(OUT_DIR, 'campaign-latest.json'), JSON.stringify(report, null, 2));
    writeFileSync(path.join(PUB_DIR, 'latest.json'), JSON.stringify(report, null, 2));
  }
  console.log(`[ai-campaign] complete: ${path.join(OUT_DIR, 'campaign-latest.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
