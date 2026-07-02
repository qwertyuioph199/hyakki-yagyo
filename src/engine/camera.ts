/**
 * World-space camera locked to a target (VS-style: no easing on follow),
 * with trauma-based screen shake. Shake is presentation-only and uses its
 * own non-sim randomness.
 */
export class Camera {
  x = 0;
  y = 0;
  offsetX = 0;
  offsetY = 0;
  shakeEnabled = true;
  private trauma = 0;

  follow(tx: number, ty: number): void {
    this.x = tx;
    this.y = ty;
  }

  /** amount in [0,1]; stacks and clamps. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  tick(): void {
    if (this.trauma <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.trauma = Math.max(0, this.trauma - 0.04);
    if (!this.shakeEnabled) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    const mag = this.trauma * this.trauma * 10;
    this.offsetX = (Math.random() * 2 - 1) * mag;
    this.offsetY = (Math.random() * 2 - 1) * mag;
  }
}
