import * as THREE from 'three';

type PatientKind = 'child' | 'adultWoman' | 'elderlyMan';

type CameraShot = 'wide' | 'lariFace' | 'behindPatient' | 'audiometer';

interface PatientAction {
  type: 'idle' | 'hand' | 'nod' | 'doubt';
  timer: number;
  duration: number;
}

const MOOD_COLORS = ['#57e389', '#ffcf4d', '#ff5252'];

class Patient {
  readonly group = new THREE.Group();
  private rightArmPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private headPivot: THREE.Group;
  private headphoneGlow: THREE.MeshStandardMaterial;
  private angerMarks: THREE.Group;
  private action: PatientAction = { type: 'idle', timer: 0, duration: 0 };
  private baseArmRotation = -0.35;
  private glow = 0;
  private mood = 0;
  private elapsed = Math.random() * 10;

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

    this.angerMarks = new THREE.Group();
    const angerMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
    const mark1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.045), angerMat);
    mark1.position.set(0.2, 0.42, 0.18);
    const dot1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), angerMat);
    dot1.position.set(0.2, 0.3, 0.18);
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.045), angerMat);
    cross1.position.set(-0.2, 0.4, 0.18);
    cross1.rotation.z = 0.7;
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.045), angerMat);
    cross2.position.set(-0.2, 0.4, 0.18);
    cross2.rotation.z = -0.7;
    this.angerMarks.add(mark1, dot1, cross1, cross2);
    this.angerMarks.visible = false;
    headPivot.add(this.angerMarks);

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

  /** 0 = calmo/feliz, 1 = irritado. Muda a cor do indicador e mostra raiva. */
  setMood(v: number): void {
    this.mood = v;
    const idx = v < 0.34 ? 0 : v < 0.67 ? 1 : 2;
    const moodColor = new THREE.Color(MOOD_COLORS[idx]);
    if (this.glow < 0.05) {
      this.headphoneGlow.emissive.copy(moodColor);
      this.headphoneGlow.emissiveIntensity = 0.35 + v * 0.9;
    }
    this.angerMarks.visible = v > 0.55;
    this.angerMarks.scale.setScalar(0.6 + v * 0.6);
  }

  update(dt: number): void {
    this.elapsed += dt;
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

    if (this.mood > 0.67) {
      headZ += Math.sin(this.elapsed * 14) * 0.06 * (this.mood - 0.67) * 3;
      leftTarget = this.baseArmRotation + 0.35;
      rightTarget = -this.baseArmRotation - 0.35;
    }

    this.rightArmPivot.rotation.z += (rightTarget - this.rightArmPivot.rotation.z) * Math.min(1, dt * 12);
    this.leftArmPivot.rotation.z += (leftTarget - this.leftArmPivot.rotation.z) * Math.min(1, dt * 12);
    this.headPivot.rotation.x += (headX - this.headPivot.rotation.x) * Math.min(1, dt * 12);
    this.headPivot.rotation.z += (headZ - this.headPivot.rotation.z) * Math.min(1, dt * 12);

    if (this.glow >= 0.05) {
      this.headphoneGlow.emissive.set('#39c8ff');
      this.headphoneGlow.emissiveIntensity = this.glow * 2.4;
    }

    const targetEmissive = this.glow;
    this.headphoneGlow.emissiveIntensity +=
      (targetEmissive * 2.4 - this.headphoneGlow.emissiveIntensity) * Math.min(1, dt * 10);
  }
}

/** Versão 3D low-poly da Lari, junto à mesa do audiômetro, espelhando o humor. */
class Lari3D {
  readonly group = new THREE.Group();
  private armL: THREE.Group;
  private armR: THREE.Group;
  private body: THREE.Group;
  private action: 'idle' | 'cheer' | 'panic' = 'idle';
  private actionTimer = 0;
  private mood = 0;
  private elapsed = 0;
  private readonly baseX = -4.45;
  private readonly baseZ = -4.15;

  constructor() {
    const toon = (color: THREE.ColorRepresentation) => new THREE.MeshToonMaterial({ color });
    const skin = toon('#eab68c');
    const coat = toon('#f5f5f0');
    const hair = toon('#181019');

    this.body = new THREE.Group();

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.24), toon('#3a3f52'));
    legs.position.y = 0.28;
    this.body.add(legs);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 10), coat);
    torso.position.y = 0.95;
    this.body.add(torso);

    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.2), toon('#26344f'));
    blouse.position.y = 0.98;
    this.body.add(blouse);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), toon('#d94848'));
    badge.position.set(0.14, 1.05, 0.22);
    this.body.add(badge);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skin);
    head.position.y = 1.5;
    head.scale.set(1, 1.06, 0.95);
    this.body.add(head);

    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), hair);
    hairBack.position.set(0, 1.54, -0.04);
    hairBack.scale.set(1, 1.15, 1);
    this.body.add(hairBack);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), hair);
    bangs.position.set(0, 1.6, 0.18);
    this.body.add(bangs);
    const shoulderHairL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hair);
    shoulderHairL.position.set(-0.22, 1.28, -0.05);
    this.body.add(shoulderHairL);
    const shoulderHairR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hair);
    shoulderHairR.position.set(0.22, 1.28, -0.05);
    this.body.add(shoulderHairR);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 6, 6),
        new THREE.MeshBasicMaterial({ color: '#3a2014' }),
      );
      eye.position.set(0.09 * side, 1.52, 0.2);
      this.body.add(eye);
    }

    const stetho = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 14, Math.PI), toon('#2f4d78'));
    stetho.position.set(0, 1.3, 0.1);
    stetho.rotation.x = Math.PI * 0.5;
    this.body.add(stetho);

    const makeArm = (side: number): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(0.3 * side, 1.18, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 3, 8), coat);
      arm.position.y = -0.2;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skin);
      hand.position.y = -0.4;
      pivot.add(hand);
      pivot.rotation.z = 0.25 * side;
      this.body.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    this.group.add(this.body);
    this.group.position.set(this.baseX, 0, this.baseZ);
    this.group.rotation.y = 0.18;
    this.group.scale.setScalar(1.28);
  }

  celebrate(): void {
    this.action = 'cheer';
    this.actionTimer = 0;
  }

  panic(): void {
    this.action = 'panic';
    this.actionTimer = 0;
  }

  setMood(v: number): void {
    this.mood = v;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.actionTimer += dt;
    const t = this.actionTimer;

    let jump = 0;
    let tremble = 0;
    let armLift = 0.25;
    if (this.action === 'cheer' && t < 1.2) {
      jump = Math.abs(Math.sin(t * 9)) * 0.22;
      armLift = 2.4;
    } else if (this.action === 'panic' && t < 1.2) {
      tremble = Math.sin(t * 40) * 0.03;
      armLift = 2.9;
    } else {
      this.action = 'idle';
      if (this.mood > 0.67) {
        tremble = Math.sin(this.elapsed * 30) * 0.012;
        armLift = 1.1;
      } else if (this.mood < 0.25) {
        jump = Math.abs(Math.sin(this.elapsed * 3.2)) * 0.05;
      }
    }

    this.group.position.y = jump;
    this.group.position.x = this.baseX + tremble;
    this.armL.rotation.z += (-armLift - this.armL.rotation.z) * Math.min(1, dt * 10);
    this.armR.rotation.z += (armLift - this.armR.rotation.z) * Math.min(1, dt * 10);
  }
}

/**
 * Consultório 3D low-poly/toon construído apenas com primitivas Three.js.
 * Fica atrás do plano do gráfico (canvas 2D overlay) e reage à jogabilidade:
 * humor dos pacientes, Lari 3D espelhando o humor e cenário que evolui com o
 * progresso da fase (luz, janela, painéis da cabine, câmera e anéis sonoros).
 */
export class ClinicScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
  private patients: Patient[] = [];
  private lari3d: Lari3D;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private windowPane!: THREE.Mesh;
  private windowPaneMat!: THREE.MeshBasicMaterial;
  private boothStrips!: THREE.MeshStandardMaterial;
  private rings: THREE.Mesh[] = [];
  private portrait = false;
  private elapsed = 0;
  private glow = 0;
  private progress = 0;
  private shot: CameraShot = 'wide';
  private shotIndex = 0;
  private shotTimer = 0;
  private readonly shotDuration = 9;
  private readonly shotOrder: CameraShot[] = [
    'wide',
    'lariFace',
    'behindPatient',
    'wide',
    'audiometer',
  ];
  private camPos = new THREE.Vector3(0, 2.4, 6.5);
  private camTarget = new THREE.Vector3(0, 1.4, -6);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x101423, 1);
    this.scene.background = new THREE.Color('#141a2e');
    this.scene.fog = new THREE.Fog('#141a2e', 14, 30);

    this.hemiLight = new THREE.HemisphereLight('#cfe6ff', '#3a2f2a', 1.05);
    this.scene.add(this.hemiLight);
    this.keyLight = new THREE.DirectionalLight('#fff4e0', 1.5);
    this.keyLight.position.set(4, 8, 6);
    this.scene.add(this.keyLight);
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

    this.lari3d = new Lari3D();
    this.scene.add(this.lari3d.group);

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1 + i * 0.5, 0.045, 8, 40),
        new THREE.MeshBasicMaterial({
          color: '#7fd8ff',
          transparent: true,
          opacity: 0.25,
        }),
      );
      ring.position.set(0, 2.1 + i * 0.35, -9.5 - i * 0.7);
      ring.visible = false;
      this.rings.push(ring);
      this.scene.add(ring);
    }

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

    this.windowPaneMat = new THREE.MeshBasicMaterial({ color: '#9fd8ff' });
    this.windowPane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.6), this.windowPaneMat);
    this.windowPane.position.set(5.6, 4.4, -12.9);
    this.scene.add(this.windowPane);
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 0.1), toon('#586284'));
    frameTop.position.set(5.6, 5.75, -12.85);
    this.scene.add(frameTop);
    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 0.1), toon('#586284'));
    frameBottom.position.set(5.6, 3.05, -12.85);
    this.scene.add(frameBottom);
    const frameMid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.1), toon('#586284'));
    frameMid.position.set(5.6, 4.4, -12.85);
    this.scene.add(frameMid);

    const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), toon('#e8eef7'));
    poster.position.set(-6.5, 4.4, -12.9);
    this.scene.add(poster);
    const posterArt = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), toon('#e2705f'));
    posterArt.position.set(-6.5, 4.6, -12.85);
    this.scene.add(posterArt);

    this.boothStrips = new THREE.MeshStandardMaterial({
      color: '#3a4468',
      emissive: new THREE.Color('#5a8bff'),
      emissiveIntensity: 0.5,
      roughness: 0.5,
    });
    for (const side of [-1, 1]) {
      const boothEdge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 7), toon('#586284'));
      boothEdge.position.set(7.4 * side, 2.5, -8);
      this.scene.add(boothEdge);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.6, 6.6), this.boothStrips);
      strip.position.set(7.22 * side, 2.4, -8);
      this.scene.add(strip);
    }
    const boothTop = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.3, 7), toon('#586284'));
    boothTop.position.set(0, 5.1, -8);
    this.scene.add(boothTop);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.2), toon('#8a6f52'));
    desk.position.set(-5.2, 0.7, -3.4);
    this.scene.add(desk);
    for (const [dx, dz] of [[-1.5, -0.4], [1.5, -0.4], [-1.5, 0.4], [1.5, 0.4]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), toon('#6e5a42'));
      leg.position.set(-5.2 + dx, 0.35, -3.4 + dz);
      this.scene.add(leg);
    }
    const audiometer = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.7), toon('#d7dbe4'));
    audiometer.position.set(-5.2, 0.92, -3.4);
    this.scene.add(audiometer);
    for (let i = 0; i < 5; i++) {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.055, 10),
        toon(i % 2 === 0 ? '#d94848' : '#4f7fb0'),
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-5.65 + i * 0.22, 0.95, -3.08);
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
    this.camera.updateProjectionMatrix();
  }

  /** Câmera cinematográfica: close no rosto da Lari 3D. */
  focusLari(): void {
    this.shot = 'lariFace';
    this.shotTimer = 0;
  }

  /** Volta para o plano geral e reinicia o ciclo de câmeras. */
  resetCamera(): void {
    this.shot = 'wide';
    this.shotIndex = 0;
    this.shotTimer = 0;
  }

  /** Enquadramento desejado do plano atual (função do progresso e da orientação). */
  private desiredCamera(): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
    const drift = Math.sin(this.progress * Math.PI) * 1.5;
    if (this.shot === 'lariFace') {
      return {
        pos: new THREE.Vector3(-3.0 + drift * 0.08, 2.05, -2.45),
        target: new THREE.Vector3(-4.45, 1.95, -4.15),
        fov: 42,
      };
    }
    if (this.shot === 'behindPatient') {
      const p = this.patients[1].group.position;
      const dir = new THREE.Vector3(-4.45 - p.x, 0, -4.15 - p.z).normalize();
      return {
        pos: new THREE.Vector3(p.x - dir.x * 2.3, 1.95, p.z - dir.z * 2.3),
        target: new THREE.Vector3(-4.45, 1.35, -4.15),
        fov: 48,
      };
    }
    if (this.shot === 'audiometer') {
      return {
        pos: new THREE.Vector3(-3.85, 1.65, -1.65),
        target: new THREE.Vector3(-5.15, 0.85, -3.4),
        fov: 44,
      };
    }
    if (this.portrait) {
      return {
        pos: new THREE.Vector3(drift * 0.4, 2.1, 5.6 - this.progress * 0.5),
        target: new THREE.Vector3(drift * 0.2, 0.4, -6),
        fov: 58,
      };
    }
    return {
      pos: new THREE.Vector3(drift, 2.6, 8.2 - this.progress * 0.9),
      target: new THREE.Vector3(drift * 0.5, 1.5, -6),
      fov: 50,
    };
  }

  /** Diretor de câmera: alterna planos periodicamente com transições suaves. */
  private updateCamera(dt: number): void {
    this.shotTimer += dt;
    if (this.shotTimer >= this.shotDuration) {
      this.shotTimer = 0;
      this.shotIndex = (this.shotIndex + 1) % this.shotOrder.length;
      this.shot = this.shotOrder[this.shotIndex];
    }
    const want = this.desiredCamera();
    const k = Math.min(1, dt * 1.6);
    this.camPos.lerp(want.pos, k);
    this.camTarget.lerp(want.target, k);
    this.camera.fov += (want.fov - this.camera.fov) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camera.updateProjectionMatrix();
  }

  /** Cenário evolui com o avanço da fase: luz de janela, painéis e câmera. */
  setProgress(progress: number, phase: 'audiometria' | 'timpanometria' | 'reflexo'): void {
    this.progress = Math.min(1, Math.max(0, progress));

    const stage = this.progress;
    const skyStages =
      phase === 'audiometria'
        ? ['#9fd8ff', '#ffc48a', '#6b5a9e']
        : phase === 'timpanometria'
          ? ['#a9e8c9', '#8fd0ff', '#7a8fe8']
          : ['#7fb4ff', '#b57ae8', '#4a3a8f'];
    const skyIdx = stage < 0.5 ? 0 : 1;
    const skyT = stage < 0.5 ? stage * 2 : (stage - 0.5) * 2;
    const from = new THREE.Color(skyStages[skyIdx]);
    const to = new THREE.Color(skyStages[skyIdx + 1]);
    this.windowPaneMat.color.copy(from.lerp(to, skyT));

    const keyStages = ['#fff4e0', '#ffd9a8', '#c8b8ff'];
    const keyIdx = stage < 0.5 ? 0 : 1;
    const keyT = stage < 0.5 ? stage * 2 : (stage - 0.5) * 2;
    this.keyLight.color.copy(
      new THREE.Color(keyStages[keyIdx]).lerp(new THREE.Color(keyStages[keyIdx + 1]), keyT),
    );

    this.boothStrips.emissive.set(phase === 'reflexo' ? '#c86bff' : '#5a8bff');

    const showRings = phase === 'reflexo';
    this.rings.forEach((ring, i) => {
      ring.visible = showRings;
      if (showRings) {
        const pulse = 1 + Math.sin(this.elapsed * 2 + i * 1.2) * 0.08 + this.glow * 0.35;
        ring.scale.setScalar(pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.12 + this.glow * 0.5;
        ring.rotation.z += 0.002 + i * 0.001;
      }
    });
  }

  onThresholdReached(): void {
    this.patients.forEach((p) => p.raiseHand());
    this.lari3d.celebrate();
  }

  onCorrect(): void {
    this.patients.forEach((p) => p.celebrate());
    this.lari3d.celebrate();
  }

  onMiss(): void {
    this.patients.forEach((p) => p.doubt());
    this.lari3d.panic();
  }

  setReflexGlow(value: number): void {
    this.glow = value;
    this.patients.forEach((p) => p.setGlow(value));
  }

  /** Irritação global (0..1): pacientes ficam irritados e a Lari 3D nervosa. */
  setMood(v: number): void {
    this.patients.forEach((p) => p.setMood(v));
    this.lari3d.setMood(v);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.updateCamera(dt);
    this.patients.forEach((p, i) => {
      p.update(dt);
      p.group.position.y = Math.sin(this.elapsed * 1.6 + i * 1.7) * 0.02;
    });
    this.lari3d.update(dt);
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
