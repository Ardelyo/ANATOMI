import * as THREE from "three";

/**
 * FreeFlyControls: Kontrol kamera bebas (Fly / Walk Camera)
 * Memungkinkan terbang bebas menembus rongga tubuh (toraks, kranium, abdomen).
 * Kontrol:
 * - W / S: Maju / Mundur
 * - A / D: Geser Kiri / Kanan
 * - Space / E: Naik
 * - Shift / Q: Turun
 * - Drag Mouse / Pointer: Arah pandang (Pitch & Yaw)
 */
export class FreeFlyControls {
  public camera: THREE.Camera;
  public domElement: HTMLElement;
  public enabled = false;
  public moveSpeed = 0.8; // meter per detik
  public lookSpeed = 0.0025; // sensitivitas mouse

  private keys = new Set<string>();
  private isPointerDown = false;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private euler = new THREE.Euler(0, 0, 0, "YXZ");

  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onPointerDownBound = this.onPointerDown.bind(this);
    this.onPointerMoveBound = this.onPointerMove.bind(this);
    this.onPointerUpBound = this.onPointerUp.bind(this);
  }

  public activate() {
    if (this.enabled) return;
    this.enabled = true;
    this.euler.setFromQuaternion(this.camera.quaternion);

    window.addEventListener("keydown", this.onKeyDownBound);
    window.addEventListener("keyup", this.onKeyUpBound);
    this.domElement.addEventListener("pointerdown", this.onPointerDownBound);
    window.addEventListener("pointermove", this.onPointerMoveBound);
    window.addEventListener("pointerup", this.onPointerUpBound);
  }

  public deactivate() {
    if (!this.enabled) return;
    this.enabled = false;
    this.keys.clear();
    this.isPointerDown = false;

    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    this.domElement.removeEventListener("pointerdown", this.onPointerDownBound);
    window.removeEventListener("pointermove", this.onPointerMoveBound);
    window.removeEventListener("pointerup", this.onPointerUpBound);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    const k = e.key.toLowerCase();
    if (["w", "s", "a", "d", "e", "q", " ", "shift"].includes(k)) {
      this.keys.add(k);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
  }

  private onPointerDown(e: PointerEvent) {
    if (!this.enabled) return;
    // Klik kiri atau tengah untuk memutar arah pandang
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      this.isPointerDown = true;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.enabled || !this.isPointerDown) return;
    const dx = e.clientX - this.prevPointerX;
    const dy = e.clientY - this.prevPointerY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= dx * this.lookSpeed;
    this.euler.x -= dy * this.lookSpeed;

    // Batasi sudut pitch agar tidak terbalik (-85° s/d +85°)
    this.euler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private onPointerUp() {
    this.isPointerDown = false;
  }

  /**
   * Update per frame dengan delta time (detik)
   */
  public update(dt: number) {
    if (!this.enabled) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const move = new THREE.Vector3();
    const speed = this.moveSpeed * dt;

    if (this.keys.has("w")) move.addScaledVector(forward, speed);
    if (this.keys.has("s")) move.addScaledVector(forward, -speed);
    if (this.keys.has("d")) move.addScaledVector(right, speed);
    if (this.keys.has("a")) move.addScaledVector(right, -speed);
    if (this.keys.has("e") || this.keys.has(" ")) move.addScaledVector(up, speed);
    if (this.keys.has("q") || this.keys.has("shift")) move.addScaledVector(up, -speed);

    if (move.lengthSq() > 0) {
      this.camera.position.add(move);
    }
  }

  public dispose() {
    this.deactivate();
  }
}
