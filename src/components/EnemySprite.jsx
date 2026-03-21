import React, { useRef, useEffect, memo } from "react";
import "../game.css";

const FRAME_W = 128;
const FRAME_H = 128;
const SCALE   = 3;

const ANIMATIONS = {
  idle:    { url: "/assets/Samurai_Commander/Idle.png",    frames: 5, fps: 8 },
  walk:    { url: "/assets/Samurai_Commander/Walk.png",    frames: 9, fps: 10 },
  run:     { url: "/assets/Samurai_Commander/Run.png",     frames: 8, fps: 14 },
  attack1: { url: "/assets/Samurai_Commander/Attack_1.png",frames: 4, fps: 12 },
  attack2: { url: "/assets/Samurai_Commander/Attack_2.png",frames: 5, fps: 12 },
  attack3: { url: "/assets/Samurai_Commander/Attack_3.png",frames: 4, fps: 12 },
  protect: { url: "/assets/Samurai_Commander/Protect.png", frames: 2, fps: 8 },
  hit:     { url: "/assets/Samurai_Commander/Hurt.png",    frames: 2, fps: 10 },
  death:   { url: "/assets/Samurai_Commander/Dead.png",    frames: 6, fps: 8  },
};

// Pre-load all frames once
const preloaded = {};
Object.values(ANIMATIONS).forEach(({ url }) => {
  if (!preloaded[url]) {
    const img = new Image();
    img.src = url;
    preloaded[url] = img;
  }
});

function EnemySprite({ x, y, phase = "idle", isFlash = false }) {
  const anim      = ANIMATIONS[phase] || ANIMATIONS.idle;
  const spriteRef = useRef(null);
  const stateRef  = useRef({ frame: 0, elapsed: 0, last: null, phase });

  useEffect(() => {
    stateRef.current.frame   = 0;
    stateRef.current.elapsed = 0;
    stateRef.current.last    = null;
    stateRef.current.phase   = phase;
  }, [phase]);

  // Set up background image and size once when animation changes
  useEffect(() => {
    const el = spriteRef.current;
    if (el && anim) {
      el.style.backgroundImage = `url('${anim.url}')`;
      el.style.backgroundSize = `${anim.frames * FRAME_W * SCALE}px ${FRAME_H * SCALE}px`;
    }
  }, [anim.url, anim.frames]);

  // Animate frame positions
  useEffect(() => {
    const { frames, fps } = anim;
    const frameDur = 1000 / fps;
    let id;

    const tick = (ts) => {
      const s = stateRef.current;
      if (s.last === null) s.last = ts;
      const dt = ts - s.last;
      s.last = ts;

      if (s.phase === phase) {
        s.elapsed += dt;
        if (s.elapsed >= frameDur) {
          s.elapsed -= frameDur;
          s.frame = phase === "death"
            ? Math.min(s.frame + 1, frames - 1)
            : (s.frame + 1) % frames;
          
          // Update DOM only when frame changes
          const el = spriteRef.current;
          if (el) {
            el.style.backgroundPositionX = `-${s.frame * FRAME_W * SCALE}px`;
          }
        }
      }

      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [anim, phase]);

  const anchorOffX = -(FRAME_W / 2) * SCALE;
  const anchorOffY = -(FRAME_H / 2) * SCALE;

  return (
    <div
      style={{
        position:   "absolute",
        left:       `${x}px`,
        top:        `${y}px`,
        width:      `${FRAME_W * SCALE}px`,
        height:     `${FRAME_H * SCALE}px`,
        // flip enemy to face left
        transform:  `translate(${anchorOffX}px, ${anchorOffY}px) scaleX(-1)`,
        overflow:   "visible",
        willChange: "transform",
        filter:     isFlash ? "brightness(2)" : "brightness(1)",
        transition: "filter 0.1s",
      }}
    >
      <div
        ref={spriteRef}
        style={{
          width:            "100%",
          height:           "100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          imageRendering:   "pixelated",
          willChange:       "background-position",
        }}
      />
    </div>
  );
}

export default memo(EnemySprite);
