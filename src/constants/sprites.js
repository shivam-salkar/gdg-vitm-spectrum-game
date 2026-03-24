const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 128;
const SCALE = 3;

export const SPRITE_DIMENSIONS = {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  SCALE,
  WIDTH: FRAME_WIDTH * SCALE,
  HEIGHT: FRAME_HEIGHT * SCALE,
  HALF_WIDTH: (FRAME_WIDTH * SCALE) / 2,
  HALF_HEIGHT: (FRAME_HEIGHT * SCALE) / 2,
};

export const PLAYER_ANIMATIONS = {
  idle: { url: "/assets/Samurai/Idle.webp", frames: 6, fps: 8 },
  walk: { url: "/assets/Samurai/Walk.webp", frames: 9, fps: 10 },
  run: { url: "/assets/Samurai/Run.webp", frames: 8, fps: 14 },
  attack1: { url: "/assets/Samurai/Attack_1.webp", frames: 4, fps: 12 },
  attack2: { url: "/assets/Samurai/Attack_2.webp", frames: 5, fps: 12 },
  attack3: { url: "/assets/Samurai/Attack_3.webp", frames: 4, fps: 12 },
  protect: { url: "/assets/Samurai/Protection.webp", frames: 3, fps: 8 },
  hit: { url: "/assets/Samurai/Hurt.webp", frames: 3, fps: 8 },
  death: { url: "/assets/Samurai/Dead.webp", frames: 6, fps: 8 },
};

export const ENEMY_ANIMATIONS = {
  idle: { url: "/assets/Samurai_Commander/Idle.webp", frames: 5, fps: 8 },
  walk: { url: "/assets/Samurai_Commander/Walk.webp", frames: 9, fps: 10 },
  run: { url: "/assets/Samurai_Commander/Run.webp", frames: 8, fps: 14 },
  attack1: {
    url: "/assets/Samurai_Commander/Attack_1.webp",
    frames: 4,
    fps: 12,
  },
  attack2: {
    url: "/assets/Samurai_Commander/Attack_2.webp",
    frames: 5,
    fps: 12,
  },
  attack3: {
    url: "/assets/Samurai_Commander/Attack_3.webp",
    frames: 4,
    fps: 12,
  },
  protect: {
    url: "/assets/Samurai_Commander/Protect.webp",
    frames: 2,
    fps: 8,
  },
  hit: { url: "/assets/Samurai_Commander/Hurt.webp", frames: 2, fps: 10 },
  death: { url: "/assets/Samurai_Commander/Dead.webp", frames: 6, fps: 8 },
};

const SHARED_SPRITE_URLS = [
  ...Object.values(PLAYER_ANIMATIONS).map(({ url }) => url),
  ...Object.values(ENEMY_ANIMATIONS).map(({ url }) => url),
];

export const CRITICAL_ASSET_URLS = [
  "/assets/background.webp",
  "/assets/gdg-logo.webp",
  "/assets/fullscreen_button.webp",
  "/assets/phone-rotate.webp",
  PLAYER_ANIMATIONS.idle.url,
  ENEMY_ANIMATIONS.idle.url,
];

export const WARM_ASSET_URLS = Array.from(
  new Set([
    ...SHARED_SPRITE_URLS,
    "/background.mp4",
    "/assets/background.webp",
    "/assets/gdg-logo.webp",
    "/assets/fullscreen_button.webp",
    "/assets/phone-rotate.webp",
    "/assets/hero-icon.webp",
    "/assets/enemy-icon.webp",
    "/assets/sword.webp",
    "/assets/sword_button.webp",
    "/assets/player_speech.mp3",
    "/assets/fight.ogg",
    "/assets/sword-slice.mp3",
    "/assets/hit.mp3",
    "/assets/argh.mp3",
  ]),
);
