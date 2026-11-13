import * as THREE from 'three';

type PatientKind = 'child' | 'adultWoman' | 'elderlyMan';

interface PatientAction {
  type: 'idle' | 'hand' | 'nod' | 'doubt';
  timer: number;
  duration: number;
}

class Patient {
  readonly group = new THREE.Group();
  private rightArmPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private headPivot: THREE.Group;
  private headphoneGlow: THREE.MeshStandardMaterial;
  private action: PatientAction = { type: 'idle', timer: 0, duration: 0 };
  private baseArmRotation = -0.35;
  private glow = 0;

  constructor(kind: PatientKind, x: number, z: number) {
    const skin = new THREE.Color(
      kind === 'child' ? '#f0c49a' : kind === 'adultWoman' ? '#c68e5f' : '#e3b184',
    );
    const shirt = new THREE.Color(
      kind === 'child' ? '#e2705f' : kind === 'adultWoman' ? '#4f7fb0' : '#6b8f6b',
    );
    const hairColor = new THREE.Color(
      kind === 'child' ? '#4a2f1d' : kind === 'adultWoman' ? '#181019' : '#b9bcc4',
    );
    const scale = kind === 'child' ? 0.72 : kind === 'elderlyMan' ? 0.94 : 1;

    const toon = (color: THREE.ColorRepresentation) =>
      new THREE.MeshToonMaterial({ color });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 4, 10), toon(shirt));
    torso.position.y = 1.05;
    torso.scale.set(scale, scale, scale * 0.75);
    this.group.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.y = 1.72 * scale;
    this.headPivot = headPivot;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), toon(skin));
    head.scale.set(1, 1.08, 0.95);
    headPivot.add(head);

    const hairMat = toon(hairColor);
    if (kind === 'elderlyMan') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
      hair.position.y = 0.08;
      headPivot.add(hair);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), hairMat);
      hair.scale.set(1, 1.05, 1);
      hair.position.set(0, 0.06, -0.05);
      headPivot.add(hair);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), toon(skin));
      face.position.set(0, -0.02, 0.08);
      face.scale.set(0.92, 0.95, 0.9);
      headPivot.add(face);
      if (kind === 'child') {
        for (const side of [-1, 1]) {
          const pigtail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), hairMat);
          pigtail.position.set(0.3 * side, -0.08, -0.05);
          headPivot.add(pigtail);
        }
      }
    }

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#241812' }),
      );
      eye.position.set(0.12 * side, 0.04, 0.3);
      headPivot.add(eye);
    }

    const phoneMat = new THREE.MeshStandardMaterial({ color: '#2a2d38', roughness: 0.6 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI), phoneMat);
    band.position.y = 0.12;
    band.rotation.z = Math.PI;
    headPivot.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12), phoneMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(0.33 * side, -0.02, 0);
      headPivot.add(cup);
    }
    this.headphoneGlow = new THREE.MeshStandardMaterial({
      color: '#8fe3ff',
      emissive: new THREE.Color('#39c8ff'),
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), this.headphoneGlow);
    indicator.position.set(0, -0.02, 0.36);
    headPivot.add(indicator);

    this.group.add(headPivot);

    const makeArm = (side: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(0.46 * side * scale, 1.38 * scale, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 3, 8), toon(shirt));
      arm.position.y = -0.26;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toon(skin));
      hand.position.y = -0.52;
      pivot.add(hand);
      pivot.rotation.z = this.baseArmRotation * side;
      this.group.add(pivot);
      return pivot;
    };
    this.leftArmPivot = makeArm(-1);
    this.rightArmPivot = makeArm(1);

    const stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.5, 12),
      toon('#3d4254'),
    );
    stool.position.y = 0.25;
    this.group.add(stool);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), toon('#5a6278'));
    seat.position.y = 0.56;
    this.group.add(seat);

    this.group.position.set(x, 0, z);
    this.group.scale.setScalar(scale);
  }

  raiseHand(): void {
    this.action = { type: 'hand', timer: 0, duration: 1.4 };
  }

  celebrate(): void {
    this.action = { type: 'nod', timer: 0, duration: 1.0 };
  }

  doubt(): void {
    this.action = { type: 'doubt', timer: 0, duration: 1.2 };
  }

  setGlow(value: number): void {
    this.glow = value;
  }

  update(dt: number): void {
    const a = this.action;
    if (a.timer < a.duration) a.timer += dt;
    const t = a.timer / a.duration;
    const done = t >= 1;
    const ease = (v: number) => Math.sin(Math.min(v, 1) * Math.PI);

    let rightTarget = this.baseArmRotation;
    let leftTarget = this.baseArmRotation;
    let headX = 0;
    let headZ = 0;

    if (!done) {
      switch (a.type) {
        case 'hand': {
          const lift = t < 0.25 ? t / 0.25 : t > 0.8 ? (1 - t) / 0.2 : 1;
          rightTarget = this.baseArmRotation - Math.PI * 0.75 * lift;
          break;
        }
        case 'nod': {
          headX = Math.sin(t * Math.PI * 4) * 0.22;
          rightTarget = this.baseArmRotation - 0.5 * ease(t);
          break;
        }
        case 'doubt': {
          headZ = Math.sin(t * Math.PI * 2) * 0.3;
          headX = 0.12 * ease(t);
          break;
        }
        default:
          break;
      }
    }

    this.rightArmPivot.rotation.z += (rightTarget - this.rightArmPivot.rotation.z) * Math.min(1, dt * 12);
    this.leftArmPivot.rotation.z += (leftTarget - this.leftArmPivot.rotation.z) * Math.min(1, dt * 12);
    this.headPivot.rotation.x += (headX - this.headPivot.rotation.x) * Math.min(1, dt * 12);
    this.headPivot.rotation.z += (headZ - this.headPivot.rotation.z) * Math.min(1, dt * 12);

    const targetEmissive = this.glow;
    this.headphoneGlow.emissiveIntensity +=
      (targetEmissive - this.headphoneGlow.emissiveIntensity) * Math.min(1, dt * 10);
  }
}

/**
 * Consultório 3D low-poly/toon construído apenas com primitivas Three.js.
 * Fica atrás do plano do gráfico (canvas 2D overlay) e reage à jogabilidade.
 */
export class ClinicScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
  private patients: Patient[] = [];
  private portrait = false;
  private elapsed = 0;
  private glow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x101423, 1);
    this.scene.background = new THREE.Color('#141a2e');
    this.scene.fog = new THREE.Fog('#141a2e', 14, 30);

    const hemi = new THREE.HemisphereLight('#cfe6ff', '#3a2f2a', 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff4e0', 1.5);
    key.position.set(4, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7fb4ff', 0.6);
    rim.position.set(-6, 4, -4);
    this.scene.add(rim);

    this.buildRoom();
    this.patients = [
      new Patient('child', -3.4, -6),
      new Patient('adultWoman', 0, -6.4),
      new Patient('elderlyMan', 3.4, -6),
    ];
    this.patients.forEach((p) => this.scene.add(p.group));

    this.camera.position.set(0, 2.4, 6.5);
    this.camera.lookAt(0, 1.4, -6);
  }

  private buildRoom(): void {
    const toon = (color: THREE.ColorRepresentation) => new THREE.MeshToonMaterial({ color });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), toon('#3c4468'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -8;
    this.scene.add(floor);

    const rug = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), toon('#4d5680'));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.01, -6);
    this.scene.add(rug);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), toon('#2a3352'));
    wall.position.set(0, 6, -13);
    this.scene.add(wall);

    const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), toon('#e8eef7'));
    poster.position.set(-6.5, 4.4, -12.9);
    this.scene.add(poster);
    const posterArt = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), toon('#e2705f'));
    posterArt.position.set(-6.5, 4.6, -12.85);
    this.scene.add(posterArt);

    for (const side of [-1, 1]) {
      const boothEdge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 7), toon('#586284'));
      boothEdge.position.set(7.4 * side, 2.5, -8);
      this.scene.add(boothEdge);
    }
    const boothTop = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.3, 7), toon('#586284'));
    boothTop.position.set(0, 5.1, -8);
    this.scene.add(boothTop);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.2), toon('#8a6f52'));
    desk.position.set(-5.6, 1.5, -3.4);
    this.scene.add(desk);
    for (const [dx, dz] of [[-1.5, -0.4], [1.5, -0.4], [-1.5, 0.4], [1.5, 0.4]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), toon('#6e5a42'));
      leg.position.set(-5.6 + dx, 0.75, -3.4 + dz);
      this.scene.add(leg);
    }
    const audiometer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.7), toon('#d7dbe4'));
    audiometer.position.set(-5.6, 1.75, -3.4);
    this.scene.add(audiometer);
    for (let i = 0; i < 5; i++) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10),
        toon(i % 2 === 0 ? '#d94848' : '#4f7fb0'),
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-6.05 + i * 0.22, 1.78, -3.05);
      this.scene.add(knob);
    }

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 10), toon('#b3593f'));
    pot.position.set(5.9, 0.25, -4.2);
    this.scene.add(pot);
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), toon('#4e8f5c'));
    foliage.position.set(5.9, 0.95, -4.2);
    this.scene.add(foliage);
  }

  setPortrait(portrait: boolean): void {
    this.portrait = portrait;
  }

  resize(width: number, height: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    if (this.portrait) {
      this.camera.fov = 58;
      this.camera.position.set(0, 2.1, 5.6);
      this.camera.lookAt(0, 0.4, -6);
    } else {
      this.camera.fov = 50;
      this.camera.position.set(0, 2.6, 8.2);
      this.camera.lookAt(0, 1.5, -6);
    }
    this.camera.updateProjectionMatrix();
  }

  onThresholdReached(): void {
    this.patients.forEach((p) => p.raiseHand());
  }

  onCorrect(): void {
    this.patients.forEach((p) => p.celebrate());
  }

  onMiss(): void {
    this.patients.forEach((p) => p.doubt());
  }

  setReflexGlow(value: number): void {
    this.glow = value;
    this.patients.forEach((p) => p.setGlow(value));
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.patients.forEach((p, i) => {
      p.update(dt);
      p.group.position.y = Math.sin(this.elapsed * 1.6 + i * 1.7) * 0.02;
    });
    this.glow *= Math.pow(0.02, dt);
    if (this.glow < 0.01) this.glow = 0;
    this.patients.forEach((p) => p.setGlow(this.glow));
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
