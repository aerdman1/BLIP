/**
 * Pooled projectile (player pulse bolts + enemy static bolts).
 * Lives in a physics group with runChildUpdate; kills itself on expiry.
 */
import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private expireAt = 0;

  fire(x: number, y: number, vx: number, vy: number, lifeMs: number): void {
    this.enableBody(true, x, y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // slightly generous vertical hitbox — arcade-friendly bolt collisions
    body.setSize(this.width, Math.max(this.height, 7));
    this.setVelocity(vx, vy);
    this.setRotation(Math.atan2(vy, vx));
    this.setDepth(25);
    this.expireAt = this.scene.time.now + lifeMs;
    // reset Pulse Ricochet counters for this pooled instance
    const s = this as unknown as { _bounces?: number; _chains?: number };
    s._bounces = 0;
    s._chains = 0;
  }

  kill(): void {
    this.disableBody(true, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (time > this.expireAt) this.kill();
  }
}

/** helper to build a pooled projectile group */
export function makeProjectileGroup(scene: Phaser.Scene, texture: string, maxSize: number): Phaser.Physics.Arcade.Group {
  return scene.physics.add.group({
    classType: Projectile,
    defaultKey: texture,
    maxSize,
    runChildUpdate: true,
    allowGravity: false,
  });
}

/* ------------------- Pulse Ricochet (Orchard signature) -------------------- */
// Passive shared helpers used by the side-view scenes' bolt colliders when the
// player owns `pulse-ricochet`. Gated at the call site via hasAbility.

/** Reflect a bolt off level geometry it just hit. Returns true if it bounced
 *  (bolt kept alive), false once it has spent all its bounces (caller kills it). */
export function ricochetBolt(b: Projectile, maxBounces: number): boolean {
  const s = b as unknown as { _bounces?: number };
  s._bounces = (s._bounces ?? 0) + 1;
  if (s._bounces > maxBounces) return false;
  const body = b.body as Phaser.Physics.Arcade.Body;
  const hitSide = body.blocked.left || body.blocked.right;
  if (hitSide) body.velocity.x *= -1;
  if (body.blocked.up || body.blocked.down) body.velocity.y *= -1;
  else if (!hitSide) body.velocity.y = -Math.abs(body.velocity.x) * 0.4;
  b.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
  return true;
}

/** After a bolt hits an enemy, redirect it toward the nearest OTHER active enemy
 *  within range (chain lightning). Returns true if it found a new target (bolt
 *  kept alive), false otherwise (caller kills it). */
export function chainToNextEnemy(
  b: Projectile,
  from: Phaser.GameObjects.GameObject,
  targets: Phaser.GameObjects.GameObject[],
  maxChains: number,
  range: number
): boolean {
  const s = b as unknown as { _chains?: number };
  s._chains = (s._chains ?? 0) + 1;
  if (s._chains > maxChains) return false;
  const body = b.body as Phaser.Physics.Arcade.Body;
  const speed = Math.hypot(body.velocity.x, body.velocity.y) || 300;
  let best: Phaser.GameObjects.Sprite | null = null;
  let bestD = range;
  for (const t of targets) {
    if (t === from || !t.active) continue;
    const g = t as Phaser.GameObjects.Sprite;
    const d = Phaser.Math.Distance.Between(b.x, b.y, g.x, g.y);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  if (!best) return false;
  const ang = Math.atan2(best.y - b.y, best.x - b.x);
  body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
  b.setRotation(ang);
  return true;
}

/** EMP Burst helper: kill every active bolt in `group` within `radius` of (x,y).
 *  Returns how many were cleared. */
export function clearBoltsInRadius(
  group: Phaser.Physics.Arcade.Group,
  x: number,
  y: number,
  radius: number
): number {
  let n = 0;
  for (const obj of group.getChildren()) {
    const b = obj as Projectile;
    if (b.active && Phaser.Math.Distance.Between(x, y, b.x, b.y) <= radius) {
      b.kill();
      n++;
    }
  }
  return n;
}

/** fire from a pooled group; returns the projectile or null when pool is full */
export function fireFrom(
  group: Phaser.Physics.Arcade.Group,
  x: number,
  y: number,
  vx: number,
  vy: number,
  lifeMs: number
): Projectile | null {
  const p = group.get(x, y) as Projectile | null;
  if (!p) return null;
  p.fire(x, y, vx, vy, lifeMs);
  return p;
}
