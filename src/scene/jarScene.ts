import * as THREE from "three";
import type { StarBody, StarPhysicsWorld, Vec3 } from "../physics/starPhysics";
import type { StarVisualState } from "../types/advent";
import { createOrigamiStarGeometry } from "./origamiStarGeometry";

export interface StarVisualSnapshot {
  readonly stateByDay: ReadonlyMap<number, StarVisualState>;
  readonly todayDay: number | null;
  readonly constellationMode: boolean;
  readonly finaleMode: boolean;
}

interface StarNode {
  readonly day: number;
  readonly group: THREE.Group;
  readonly starMesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly badgeSprite: THREE.Sprite;
  readonly badgeMaterial: THREE.SpriteMaterial;
  readonly hitMesh: THREE.Mesh;
  wiggleRemaining: number;
}

/** Scene-space strength of gravity (real 9.81 m/s^2 feels too heavy for paper stars). */
const GRAVITY_STRENGTH = 5.2;
/** Scene acceleration per m/s^2 of real phone acceleration (tuned so shaking tumbles the stars while walking only makes them jingle). */
const INERTIA_GAIN = 3.5;
const MAX_INERTIA = 100;
/** How strongly the stars lag behind when the jar is twisted. */
const SWIRL_COUPLING = 0.85;
const MAX_SWIRL_STEP = 4;
/** Half extents (scene units, incl. margin) that must stay visible around the jar. */
const JAR_FIT_HALF_WIDTH = 2.1;
const JAR_FIT_HALF_HEIGHT = 3.2;
/** Radius of the invisible tap target around each star. */
const STAR_HIT_RADIUS = 0.42;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const GLASS_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const GLASS_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uGlowBoost;

  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vec3 n = normalize(vNormalView);
    vec3 v = normalize(vViewDir);
    float ndotv = abs(dot(n, v));

    float fresnel = pow(1.0 - ndotv, 2.5);
    vec3 lightDir1 = normalize(vec3(-0.55, 0.72, 0.65));
    vec3 half1 = normalize(lightDir1 + v);
    float spec1 = pow(max(dot(n, half1), 0.0), 64.0);

    vec3 lightDir2 = normalize(vec3(0.75, 0.3, 0.45));
    vec3 half2 = normalize(lightDir2 + v);
    float spec2 = pow(max(dot(n, half2), 0.0), 36.0);

    // Subtle vertical glass sheen reflection strip.
    float rimHighlight = smoothstep(0.55, 0.95, fresnel);
    vec3 baseGlass = vec3(1.0, 0.93, 0.82);
    vec3 warmGold = vec3(1.0, 0.84, 0.56);

    vec3 color = mix(baseGlass, warmGold, rimHighlight * 0.55 + uGlowBoost * 0.25);
    color += vec3(1.0, 0.97, 0.92) * (spec1 * 0.95 + spec2 * 0.45);

    float edgeFade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
    float alpha = (0.055 + fresnel * 0.46 + spec1 * 0.55 + spec2 * 0.22) * edgeFade;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
  }
`;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSnowBoost;

  varying float vAlpha;
  varying float vWarmth;

  void main() {
    vec3 pos = position;
    float swirl = uTime * (0.28 + uSnowBoost * 0.55) + aPhase;
    pos.x += sin(swirl) * (0.09 + uSnowBoost * 0.22);
    pos.z += cos(swirl * 0.85) * (0.09 + uSnowBoost * 0.22);

    // Gentle snowglobe fall when Finale mode is active, otherwise dreamy float.
    float fall = mod(pos.y - uTime * (0.12 + uSnowBoost * 0.55) + 2.4, 4.8) - 2.4;
    pos.y = mix(pos.y + sin(uTime * 0.9 + aPhase) * 0.1, fall, clamp(uSnowBoost * 0.85, 0.0, 1.0));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aScale * uPixelRatio * (1.0 + uSnowBoost * 0.45) * (180.0 / max(1.0, -mvPosition.z));

    float twinkle = 0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 3.0);
    vAlpha = (0.28 + twinkle * 0.55) * (0.75 + uSnowBoost * 0.55);
    vWarmth = fract(aPhase * 0.618);
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying float vWarmth;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = length(centered);
    if (dist > 0.5) {
      discard;
    }

    float glow = smoothstep(0.5, 0.04, dist);
    glow = pow(glow, 1.8);

    vec3 cream = vec3(1.0, 0.96, 0.86);
    vec3 gold = vec3(1.0, 0.78, 0.42);
    vec3 color = mix(gold, cream, vWarmth);

    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

function createNumberBadgeTexture(
  day: number,
  state: StarVisualState
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    const fillColor =
      state === "available_today"
        ? "rgba(255, 226, 130, 0.96)"
        : state === "opened"
          ? "rgba(255, 198, 112, 0.92)"
          : state === "available_past"
            ? "rgba(255, 214, 194, 0.9)"
            : "rgba(32, 22, 42, 0.72)";

    const strokeColor =
      state === "locked"
        ? "rgba(255, 232, 200, 0.35)"
        : "rgba(255, 250, 235, 0.85)";

    const textColor = state === "locked" ? "#ebd8c8" : "#2c1614";

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 42, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "700 44px -apple-system, BlinkMacSystemFont, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(day), size / 2, size / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Badge with a winking face, shown briefly on stars whose day she missed.
 */
function createWinkBadgeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 42, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 222, 150, 0.97)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 250, 235, 0.9)";
    ctx.stroke();

    ctx.strokeStyle = "#2c1614";
    ctx.fillStyle = "#2c1614";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";

    // Open left eye.
    ctx.beginPath();
    ctx.arc(48, 54, 6, 0, Math.PI * 2);
    ctx.fill();
    // Closed (winking) right eye.
    ctx.beginPath();
    ctx.arc(80, 58, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Smile.
    ctx.beginPath();
    ctx.arc(64, 62, 22, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Seconds between two winks of a missed star, and how long one wink lasts. */
const WINK_INTERVAL_SECONDS = 5.5;
const WINK_DURATION_SECONDS = 0.7;

function createJarSilhouetteGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -2.06),
    new THREE.Vector2(1.42, -2.06),
    new THREE.Vector2(1.68, -1.88),
    new THREE.Vector2(1.74, -1.55),
    new THREE.Vector2(1.74, 1.15),
    new THREE.Vector2(1.66, 1.46),
    new THREE.Vector2(1.32, 1.72),
    new THREE.Vector2(1.26, 1.96),
    new THREE.Vector2(1.34, 2.04),
    new THREE.Vector2(1.22, 2.08),
  ];
  return new THREE.LatheGeometry(points, 48);
}

/**
 * Interactive Three.js WebGL scene rendering the glowing apothecary jar,
 * 24 physics-driven Origami stars, golden constellation filaments, and snowglobe particles.
 */
export class JarScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly physics: StarPhysicsWorld;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly jarRoot: THREE.Group;
  private readonly starNodes: StarNode[] = [];
  private readonly hitMeshes: THREE.Mesh[] = [];
  private readonly constellationBuffer = new Float32Array(24 * 2 * 3);
  private readonly constellationAttribute = new THREE.BufferAttribute(
    this.constellationBuffer,
    3
  );
  private readonly constellationGeometry: THREE.BufferGeometry;
  private readonly constellationMaterial: THREE.LineBasicMaterial;
  private readonly constellationLines: THREE.LineSegments;
  private readonly glassMaterial: THREE.ShaderMaterial;
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly coreLight: THREE.PointLight;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  private readonly badgeCache = new Map<string, THREE.CanvasTexture>();
  private readonly winkTexture = createWinkBadgeTexture();
  private readonly starVisualStates = new Map<number, StarVisualState>();
  private todayDay: number | null = null;
  private constellationMode = false;
  private finaleMode = false;
  private constellationBlend = 0;
  private shakeEnergy = 0;

  /** Direction of "down" in screen space; follows the phone once sensors are live. */
  private gravityDirection: Vec3 = { x: 0, y: -1, z: 0 };
  /** Latest linear phone acceleration in screen space (m/s^2). */
  private linearAcceleration: Vec3 = { x: 0, y: 0, z: 0 };
  private twistRate = 0;
  private previousJarYawRate = 0;
  private sensorsLive = false;
  private parallaxYaw = 0;
  private parallaxPitch = 0;
  private todayCharge = 0;
  private jarMesh: THREE.Mesh | null = null;
  private readonly inverseJarQuat = new THREE.Quaternion();
  private readonly scratchVector = new THREE.Vector3();
  private readonly cameraForward = new THREE.Vector3();
  private orbitYaw = 0;
  private targetOrbitYaw = 0;
  private orbitPitch = 0.08;
  private targetOrbitPitch = 0.08;

  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerMovedDistance = 0;
  private lastPointerTimeMs = 0;

  private rafId: number | null = null;
  private lastFrameTimeMs = 0;
  private elapsedTime = 0;
  private disposed = false;

  private readonly onStarTap: (day: number) => void;
  private readonly onCollision: (intensity: number, day: number) => void;
  private readonly onGlassKnock: () => void;

  constructor(options: {
    canvas: HTMLCanvasElement;
    physics: StarPhysicsWorld;
    onStarTap: (day: number) => void;
    onCollision: (intensity: number, day: number) => void;
    onGlassKnock: () => void;
  }) {
    this.canvas = options.canvas;
    this.physics = options.physics;
    this.onStarTap = options.onStarTap;
    this.onCollision = options.onCollision;
    this.onGlassKnock = options.onGlassKnock;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this.camera.position.set(0, 0.18, 7.6);

    this.jarRoot = new THREE.Group();
    this.scene.add(this.jarRoot);

    this.coreLight = new THREE.PointLight(0xffcb78, 12, 14, 1.5);
    this.coreLight.position.set(0, 0.1, 0.4);
    this.jarRoot.add(this.coreLight);

    this.setupLights();
    this.glassMaterial = this.buildJarStructure();
    this.buildStars();

    this.constellationGeometry = new THREE.BufferGeometry();
    this.constellationGeometry.setAttribute(
      "position",
      this.constellationAttribute
    );
    this.constellationGeometry.setDrawRange(0, 0);
    this.constellationMaterial = new THREE.LineBasicMaterial({
      color: 0xffe299,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.constellationLines = new THREE.LineSegments(
      this.constellationGeometry,
      this.constellationMaterial
    );
    this.constellationLines.frustumCulled = false;
    this.jarRoot.add(this.constellationLines);

    this.particleMaterial = this.buildBokehParticles();

    this.handleResize();
    this.bindEvents();
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffe7cf, 0.72);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xffe4c4, 0x261533, 0.9);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.7);
    keyLight.position.set(-4, 6, 6);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xf3a392, 9, 15, 1.6);
    rimLight.position.set(3.5, -2.0, -2.5);
    this.scene.add(rimLight);
  }

  private buildJarStructure(): THREE.ShaderMaterial {
    // Ground pedestal shadow halo
    const baseRingGeo = new THREE.CylinderGeometry(1.78, 1.9, 0.12, 48);
    const baseRingMat = new THREE.MeshStandardMaterial({
      color: 0x27192d,
      roughness: 0.75,
      metalness: 0.25,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.position.set(0, -2.14, 0);
    this.jarRoot.add(baseRing);

    // Cork stopper
    const corkGeo = new THREE.CylinderGeometry(1.16, 1.04, 0.56, 36);
    const corkMat = new THREE.MeshStandardMaterial({
      color: 0xb98252,
      roughness: 0.9,
      metalness: 0.04,
    });
    const cork = new THREE.Mesh(corkGeo, corkMat);
    cork.position.set(0, 2.2, 0);
    this.jarRoot.add(cork);

    // Golden anniversary ribbon collar around neck
    const collarGeo = new THREE.TorusGeometry(1.27, 0.055, 16, 48);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xf4c46b,
      emissive: 0x5c3c12,
      emissiveIntensity: 0.4,
      roughness: 0.28,
      metalness: 0.85,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.88, 0);
    this.jarRoot.add(collar);

    // Custom GLSL Fresnel Glass Body
    const jarGeo = createJarSilhouetteGeometry();
    const glassMat = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERTEX_SHADER,
      fragmentShader: GLASS_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uGlowBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const jarMesh = new THREE.Mesh(jarGeo, glassMat);
    jarMesh.renderOrder = 10;
    this.jarRoot.add(jarMesh);
    this.jarMesh = jarMesh;

    return glassMat;
  }

  private buildStars(): void {
    const starGeo = createOrigamiStarGeometry(1.0, 0.55, 0.44);
    const hitGeo = new THREE.SphereGeometry(STAR_HIT_RADIUS, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    for (const body of this.physics.bodies) {
      const group = new THREE.Group();
      group.position.set(body.position.x, body.position.y, body.position.z);

      const material = new THREE.MeshStandardMaterial({
        color: 0xd9cabf,
        emissive: 0x3b2a34,
        emissiveIntensity: 0.28,
        roughness: 0.52,
        metalness: 0.14,
        flatShading: true,
      });

      const starMesh = new THREE.Mesh(starGeo, material);
      starMesh.scale.setScalar(body.radius);
      starMesh.userData = { day: body.day };
      group.add(starMesh);

      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { day: body.day };
      group.add(hitMesh);
      this.hitMeshes.push(hitMesh);

      const texture = this.getOrCreateBadgeTexture(body.day, "locked");
      const badgeMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      });
      const badgeSprite = new THREE.Sprite(badgeMaterial);
      badgeSprite.scale.set(0.24, 0.24, 1);
      badgeSprite.renderOrder = 20;
      this.jarRoot.add(badgeSprite);

      this.jarRoot.add(group);
      this.starNodes.push({
        day: body.day,
        group,
        starMesh,
        material,
        badgeSprite,
        badgeMaterial,
        hitMesh,
        wiggleRemaining: 0,
      });
    }
  }

  private buildBokehParticles(): THREE.ShaderMaterial {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const isInside = i < 110;
      const radius = isInside
        ? Math.sqrt(Math.random()) * 1.48
        : 1.9 + Math.random() * 2.2;
      const y = isInside
        ? -1.8 + Math.random() * 3.5
        : -2.4 + Math.random() * 4.8;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      scales[i] = 0.22 + Math.random() * 0.42;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uSnowBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 15;
    this.jarRoot.add(points);
    return material;
  }

  private getOrCreateBadgeTexture(
    day: number,
    state: StarVisualState
  ): THREE.CanvasTexture {
    const key = `${day}:${state}`;
    const existing = this.badgeCache.get(key);
    if (existing) {
      return existing;
    }
    const created = createNumberBadgeTexture(day, state);
    this.badgeCache.set(key, created);
    return created;
  }

  public start(): void {
    if (this.rafId !== null || this.disposed) {
      return;
    }
    this.lastFrameTimeMs = performance.now();
    const loop = (nowMs: number): void => {
      if (this.disposed) {
        return;
      }
      const dt = Math.min((nowMs - this.lastFrameTimeMs) / 1000, 0.05);
      this.lastFrameTimeMs = nowMs;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  public updateVisualSnapshot(snapshot: StarVisualSnapshot): void {
    this.todayDay = snapshot.todayDay;
    this.constellationMode = snapshot.constellationMode;
    this.finaleMode = snapshot.finaleMode;

    let openedCount = 0;
    for (const node of this.starNodes) {
      const nextState = snapshot.stateByDay.get(node.day) ?? "locked";
      this.starVisualStates.set(node.day, nextState);
      if (nextState === "opened") {
        openedCount++;
      }

      const texture = this.getOrCreateBadgeTexture(node.day, nextState);
      if (node.badgeMaterial.map !== texture) {
        node.badgeMaterial.map = texture;
        node.badgeMaterial.needsUpdate = true;
      }

      this.applyMaterialForState(node, nextState);
    }

    const openedProgress = openedCount / 24;
    this.coreLight.intensity = 10 + openedProgress * 18;
    this.glassMaterial.uniforms.uGlowBoost.value = openedProgress;
  }

  /** Sets where "down" is in screen space (unit vector from the motion sensors). */
  public setGravityDirection(direction: Vec3): void {
    this.gravityDirection = direction;
    this.sensorsLive = true;
  }

  /** Sets the phone's current linear acceleration in screen space (m/s^2). */
  public setLinearAcceleration(acceleration: Vec3): void {
    this.linearAcceleration = acceleration;
  }

  /** Sets how fast the phone is being twisted around the jar's vertical axis (rad/s). */
  public setTwistRate(radiansPerSecond: number): void {
    this.twistRate = radiansPerSecond;
  }

  /** Sets how far today's star has been "woken up" by shaking (0..1). */
  public setTodayCharge(charge: number): void {
    this.todayCharge = clamp(charge, 0, 1);
  }

  public registerShakeBurst(amount = 0.75): void {
    this.shakeEnergy = Math.min(1.0, this.shakeEnergy + amount);
  }

  public triggerLockedStarWiggle(day: number): void {
    const node = this.starNodes.find((n) => n.day === day);
    if (node) {
      node.wiggleRemaining = 0.48;
    }
  }

  private applyMaterialForState(
    node: StarNode,
    state: StarVisualState
  ): void {
    switch (state) {
      case "locked":
        node.material.color.setHex(0xd6c6bc);
        node.material.emissive.setHex(0x362432);
        node.material.emissiveIntensity = 0.25;
        node.material.roughness = 0.72;
        break;
      case "available_past":
        node.material.color.setHex(0xffd2b5);
        node.material.emissive.setHex(0xd97358);
        node.material.emissiveIntensity = 0.56;
        node.material.roughness = 0.42;
        break;
      case "available_today":
        node.material.color.setHex(0xffe694);
        node.material.emissive.setHex(0xffb52e);
        node.material.emissiveIntensity = 1.15;
        node.material.roughness = 0.28;
        break;
      case "opened":
        node.material.color.setHex(0xffca6b);
        node.material.emissive.setHex(0xf29327);
        node.material.emissiveIntensity = 0.85;
        node.material.roughness = 0.34;
        break;
    }
  }

  private update(dt: number): void {
    this.elapsedTime += dt;

    const targetBlend = this.constellationMode ? 1 : 0;
    this.constellationBlend += (targetBlend - this.constellationBlend) * Math.min(1, dt * 4.5);

    this.shakeEnergy = Math.max(0, this.shakeEnergy - dt * 0.85);
    const snowBoost = Math.max(
      this.shakeEnergy,
      this.finaleMode ? 0.85 : 0
    );

    this.glassMaterial.uniforms.uTime.value = this.elapsedTime;
    this.particleMaterial.uniforms.uTime.value = this.elapsedTime;
    this.particleMaterial.uniforms.uSnowBoost.value = snowBoost;

    // Smooth jar orbit interpolation.
    const previousOrbitYaw = this.orbitYaw;
    this.orbitYaw += (this.targetOrbitYaw - this.orbitYaw) * Math.min(1, dt * 8);
    this.orbitPitch +=
      (this.targetOrbitPitch - this.orbitPitch) * Math.min(1, dt * 8);
    if (!this.isPointerDown && !this.constellationMode) {
      this.targetOrbitYaw += dt * 0.06;
    }

    // Tilting the phone lets her peek around the jar (only with live sensors).
    // -0.64 is the gravity z component of a phone held at a relaxed reading angle.
    const parallaxYawTarget = this.sensorsLive
      ? clamp(this.gravityDirection.x, -1, 1) * 0.32
      : 0;
    const parallaxPitchTarget = this.sensorsLive
      ? clamp(-this.gravityDirection.z - 0.64, -0.6, 0.4) * 0.35
      : 0;
    const parallaxEase = Math.min(1, dt * 6);
    this.parallaxYaw += (parallaxYawTarget - this.parallaxYaw) * parallaxEase;
    this.parallaxPitch +=
      (parallaxPitchTarget - this.parallaxPitch) * parallaxEase;

    this.jarRoot.rotation.y = this.orbitYaw + this.parallaxYaw;
    this.jarRoot.rotation.x = this.orbitPitch + this.parallaxPitch;
    this.jarRoot.updateMatrixWorld();
    this.inverseJarQuat.copy(this.jarRoot.quaternion).invert();

    // Physics runs in the jar's own frame, so sensor input is rotated into it.
    const localGravity = this.toJarFrame(this.gravityDirection, GRAVITY_STRENGTH);
    const localInertia = this.toJarFrame(
      this.linearAcceleration,
      -INERTIA_GAIN,
      MAX_INERTIA
    );

    // Twisting the jar (gyroscope or drag) leaves the stars behind for a moment.
    const safeDt = Math.max(dt, 1 / 240);
    const jarYawRate =
      (this.orbitYaw - previousOrbitYaw) / safeDt + this.twistRate;
    if (!this.constellationMode) {
      this.physics.applySwirl(
        clamp(
          jarYawRate - this.previousJarYawRate,
          -MAX_SWIRL_STEP,
          MAX_SWIRL_STEP
        ) * SWIRL_COUPLING
      );
    }
    this.previousJarYawRate = jarYawRate;

    const collisions = this.physics.step(
      dt,
      localGravity,
      this.constellationBlend,
      this.todayDay,
      localInertia
    );

    for (let i = 0; i < Math.min(collisions.length, 3); i++) {
      const col = collisions[i];
      this.onCollision(col.intensity, col.dayA);
    }

    this.camera.getWorldDirection(this.cameraForward);
    const localTowardCamera = this.cameraForward
      .negate()
      .applyQuaternion(this.inverseJarQuat)
      .normalize();

    for (let i = 0; i < this.starNodes.length; i++) {
      const node = this.starNodes[i];
      const body: StarBody = this.physics.bodies[i];
      const state = this.starVisualStates.get(node.day) ?? "locked";

      let wiggleOffsetX = 0;
      if (node.wiggleRemaining > 0) {
        node.wiggleRemaining = Math.max(0, node.wiggleRemaining - dt);
        wiggleOffsetX =
          Math.sin(node.wiggleRemaining * 42) * 0.06 * (node.wiggleRemaining / 0.48);
      }

      node.group.position.set(
        body.position.x + wiggleOffsetX,
        body.position.y,
        body.position.z
      );

      if (this.constellationBlend > 0.65) {
        node.starMesh.rotation.set(0, this.elapsedTime * 0.4, 0);
      } else {
        node.starMesh.rotation.set(
          body.rotation.x,
          body.rotation.y,
          body.rotation.z
        );
      }

      // Stars whose day she missed wink at her every few seconds (staggered per star).
      const isWinking =
        state === "available_past" &&
        (this.elapsedTime + node.day * 1.7) % WINK_INTERVAL_SECONDS <
          WINK_DURATION_SECONDS;
      if (state === "available_past") {
        const badgeTexture = isWinking
          ? this.winkTexture
          : this.getOrCreateBadgeTexture(node.day, state);
        if (node.badgeMaterial.map !== badgeTexture) {
          node.badgeMaterial.map = badgeTexture;
          node.badgeMaterial.needsUpdate = true;
        }
      }

      if (state === "available_today") {
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 3.4);
        node.starMesh.scale.setScalar(
          body.radius * (1.08 + pulse * 0.14 + this.todayCharge * 0.3)
        );
        node.material.emissiveIntensity =
          0.95 + pulse * 0.65 + this.todayCharge * 1.6;
      } else if (state === "available_past") {
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 2.1 + node.day);
        node.starMesh.scale.setScalar(
          body.radius * (1.02 + (isWinking ? 0.16 : 0))
        );
        node.material.emissiveIntensity = 0.48 + pulse * 0.22;
      } else {
        node.starMesh.scale.setScalar(body.radius);
      }

      // Position badge just outside the star toward the camera for legibility.
      node.badgeSprite.position
        .copy(node.group.position)
        .addScaledVector(localTowardCamera, body.radius * 1.32);
      node.badgeSprite.position.y += 0.08;

      const badgeScale = isWinking
        ? 0.34
        : state === "available_today"
          ? 0.29
          : 0.22;
      node.badgeSprite.scale.set(badgeScale, badgeScale, 1);
    }

    this.updateConstellationLines();
  }

  /**
   * Rotates a screen-space vector into the jar's local frame and scales it,
   * optionally limiting its length.
   */
  private toJarFrame(vector: Vec3, scale: number, maxLength = Infinity): Vec3 {
    this.scratchVector
      .set(vector.x, vector.y, vector.z)
      .multiplyScalar(scale)
      .clampLength(0, maxLength)
      .applyQuaternion(this.inverseJarQuat);
    return {
      x: this.scratchVector.x,
      y: this.scratchVector.y,
      z: this.scratchVector.z,
    };
  }

  /**
   * Drags stars under the finger / cursor along with it, like stirring the jar.
   */
  private stirStars(
    clientX: number,
    clientY: number,
    dxPixels: number,
    dyPixels: number,
    dtSeconds: number
  ): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const worldPerPixel =
      (2 *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
        this.camera.position.z) /
      rect.height;
    const velocityX = clamp((dxPixels * worldPerPixel) / dtSeconds, -9, 9);
    const velocityY = clamp((-dyPixels * worldPerPixel) / dtSeconds, -9, 9);
    if (Math.hypot(velocityX, velocityY) < 0.4) {
      return;
    }

    const reachPixels = Math.max(56, rect.height * 0.09);
    const follow = Math.min(1, dtSeconds * 14);

    for (const node of this.starNodes) {
      this.scratchVector
        .copy(node.group.position)
        .applyMatrix4(this.jarRoot.matrixWorld)
        .project(this.camera);
      const screenX = (this.scratchVector.x * 0.5 + 0.5) * rect.width + rect.left;
      const screenY = (-this.scratchVector.y * 0.5 + 0.5) * rect.height + rect.top;
      const distance = Math.hypot(screenX - clientX, screenY - clientY);
      if (distance >= reachPixels) {
        continue;
      }

      const weight = (1 - distance / reachPixels) * follow;
      this.physics.nudgeBody(
        node.day,
        this.toJarFrame({ x: velocityX, y: velocityY, z: 0 }, weight)
      );
    }
  }

  private updateConstellationLines(): void {
    const activeNodes: StarNode[] = [];

    for (const node of this.starNodes) {
      const state = this.starVisualStates.get(node.day) ?? "locked";
      if (this.constellationMode || state === "opened") {
        activeNodes.push(node);
      }
    }

    if (activeNodes.length < 2) {
      this.constellationGeometry.setDrawRange(0, 0);
      return;
    }

    let floatOffset = 0;
    let vertexCount = 0;

    for (let i = 0; i < activeNodes.length - 1; i++) {
      const a = activeNodes[i].group.position;
      const b = activeNodes[i + 1].group.position;
      this.constellationBuffer[floatOffset++] = a.x;
      this.constellationBuffer[floatOffset++] = a.y;
      this.constellationBuffer[floatOffset++] = a.z;
      this.constellationBuffer[floatOffset++] = b.x;
      this.constellationBuffer[floatOffset++] = b.y;
      this.constellationBuffer[floatOffset++] = b.z;
      vertexCount += 2;
    }

    if (activeNodes.length >= 24) {
      const first = activeNodes[0].group.position;
      const last = activeNodes[activeNodes.length - 1].group.position;
      this.constellationBuffer[floatOffset++] = last.x;
      this.constellationBuffer[floatOffset++] = last.y;
      this.constellationBuffer[floatOffset++] = last.z;
      this.constellationBuffer[floatOffset++] = first.x;
      this.constellationBuffer[floatOffset++] = first.y;
      this.constellationBuffer[floatOffset++] = first.z;
      vertexCount += 2;
    }

    this.constellationAttribute.needsUpdate = true;
    this.constellationGeometry.setDrawRange(0, vertexCount);
    this.constellationMaterial.opacity = this.constellationMode ? 0.8 : 0.42;
  }

  private bindEvents(): void {
    window.addEventListener("resize", this.handleResize);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
  }

  private readonly handleResize = (): void => {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    this.camera.aspect = width / height;
    // Pull the camera back until the whole jar fits: on narrow portrait iPhones the
    // width is the limit, on wide screens the height (plus room for the HUD).
    const halfFovTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distanceForWidth =
      JAR_FIT_HALF_WIDTH / (halfFovTan * this.camera.aspect);
    const distanceForHeight = JAR_FIT_HALF_HEIGHT / halfFovTan;
    this.camera.position.z = Math.max(distanceForWidth, distanceForHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.particleMaterial.uniforms.uPixelRatio.value = Math.min(
      window.devicePixelRatio || 1,
      2
    );
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.isPointerDown = true;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerMovedDistance = 0;
    this.lastPointerTimeMs = event.timeStamp;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.isPointerDown) {
      return;
    }

    const dx = event.clientX - this.lastPointerX;
    const dy = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerMovedDistance += Math.hypot(dx, dy);

    this.targetOrbitYaw += dx * 0.0085;
    this.targetOrbitPitch = Math.max(
      -0.35,
      Math.min(0.45, this.targetOrbitPitch + dy * 0.005)
    );

    // Stars under the finger / cursor are dragged along.
    const dtSeconds = clamp(
      (event.timeStamp - this.lastPointerTimeMs) / 1000,
      1 / 240,
      0.1
    );
    this.lastPointerTimeMs = event.timeStamp;
    if (!this.constellationMode) {
      this.stirStars(event.clientX, event.clientY, dx, dy, dtSeconds);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.isPointerDown) {
      return;
    }
    this.isPointerDown = false;

    const totalMove = Math.hypot(
      event.clientX - this.pointerStartX,
      event.clientY - this.pointerStartY
    );
    if (totalMove < 12 && this.pointerMovedDistance < 16) {
      this.pickStarAtClientPoint(event.clientX, event.clientY);
    }
  };

  private pickStarAtClientPoint(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);

    if (hits.length > 0) {
      const dayValue = hits[0].object.userData.day;
      if (typeof dayValue === "number") {
        this.onStarTap(dayValue);
      }
      return;
    }

    // No star under the finger: knocking on the glass makes nearby stars jump.
    if (!this.jarMesh || this.constellationMode) {
      return;
    }
    const glassHits = this.raycaster.intersectObject(this.jarMesh, false);
    if (glassHits.length > 0) {
      const localPoint = this.jarRoot.worldToLocal(glassHits[0].point.clone());
      this.physics.applyKnock({
        x: localPoint.x,
        y: localPoint.y,
        z: localPoint.z,
      });
      this.registerShakeBurst(0.2);
      this.onGlassKnock();
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);

    for (const texture of this.badgeCache.values()) {
      texture.dispose();
    }
    this.winkTexture.dispose();
    this.badgeCache.clear();
    this.renderer.dispose();
  }
}
