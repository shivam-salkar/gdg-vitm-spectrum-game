import { SPRITE_DIMENSIONS } from "./sprites.js";

export const CONFIG = {
  STAGE_WIDTH: 1024,
  STAGE_HEIGHT: 480,
  PLAYER_MAX_HP: 2000,
  ENEMY_MAX_HP: 1200,
  PLAYER_DAMAGE_PER_HIT: 10,
  ENEMY_DAMAGE_PER_HIT: 7,
  OFFLINE_PLAYER_DAMAGE_PER_HIT: 38,
  OFFLINE_ENEMY_DAMAGE_PER_HIT: 45,
  FRAMES_PER_SECOND: 12, // For custom pixel animations
};

const STAGE_SIDE_MARGIN = 96;
const DUEL_STEP_IN = 170;
const FLOOR_MARGIN = 8;

// Sprite positions stay inside the 1024x480 stage with a small safety margin
// so Chrome's mobile rounding doesn't push the enemy offscreen.
export const SPRITE_POSITIONS = {
  PLAYER_HOME_X: SPRITE_DIMENSIONS.HALF_WIDTH + STAGE_SIDE_MARGIN,
  ENEMY_HOME_X:
    CONFIG.STAGE_WIDTH - SPRITE_DIMENSIONS.HALF_WIDTH - STAGE_SIDE_MARGIN,
  PLAYER_ATTACK_X:
    CONFIG.STAGE_WIDTH - SPRITE_DIMENSIONS.HALF_WIDTH - DUEL_STEP_IN,
  ENEMY_ATTACK_X: SPRITE_DIMENSIONS.HALF_WIDTH + DUEL_STEP_IN,
  SPRITE_Y: CONFIG.STAGE_HEIGHT - SPRITE_DIMENSIONS.HALF_HEIGHT - FLOOR_MARGIN,
};

// Online combat stays conservative because the server is the source of truth.
// Offline combat uses higher local-only damage so the fallback fight lands near ~45s
// instead of several minutes while still giving the enemy enough damage to feel active.
