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
