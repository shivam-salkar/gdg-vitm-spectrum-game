import React, { useRef, useEffect, useState, memo } from "react";
import "../game.css";

const FRAME_W = 128;
const FRAME_H = 128;
const SCALE = 3;

const ANIMATIONS = {
  idle: { url: "/assets/Samurai/Idle.png", frames: 6, fps: 8 },
  walk: { url: "/assets/Samurai/Walk.png", frames: 9, fps: 10 },
  run: { url: "/assets/Samurai/Run.png", frames: 8, fps: 14 },
  attack1: { url: "/assets/Samurai/Attack_1.png", frames: 4, fps: 12 },
  attack2: { url: "/assets/Samurai/Attack_2.png", frames: 5, fps: 12 },
  attack3: { url: "/assets/Samurai/Attack_3.png", frames: 4, fps: 12 },
  protect: { url: "/assets/Samurai/Protection.png", frames: 3, fps: 8 },
  hit: { url: "/assets/Samurai/Hurt.png", frames: 3, fps: 8 },
  death: { url: "/assets/Samurai/Dead.png", frames: 6, fps: 8 },
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

function PlayerSprite({ x, y, phase = "idle", freeze = false }) {
  const anim = ANIMATIONS[phase] || ANIMATIONS.idle;
  const spriteRef = useRef(null);
  const stateRef = useRef({ frame: 0, elapsed: 0, last: null, phase });

  // When phase changes, reset frame counter immediately
  useEffect(() => {
    stateRef.current.frame = 0;
    stateRef.current.elapsed = 0;
    stateRef.current.last = null;
    stateRef.current.phase = phase;
  }, [phase, freeze]);

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
    if (freeze) {
      const el = spriteRef.current;
      stateRef.current.frame = 0;
      stateRef.current.elapsed = 0;
      stateRef.current.last = null;
      if (el) {
        el.style.backgroundPositionX = "0px";
      }
      return;
    }

    const { frames, fps } = anim;
    const frameDur = 1000 / fps; // ms per frame
    let id;

    const tick = (ts) => {
      const s = stateRef.current;
      if (s.last === null) s.last = ts;
      const dt = ts - s.last;
      s.last = ts;

      // Only advance if still on same phase
      if (s.phase === phase) {
        s.elapsed += dt;
        if (s.elapsed >= frameDur) {
          s.elapsed -= frameDur;
          s.frame =
            phase === "death"
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
  }, [anim, phase, freeze]);

  const anchorOffX = -(FRAME_W / 2) * SCALE;
  const anchorOffY = -(FRAME_H / 2) * SCALE;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${FRAME_W * SCALE}px`,
        height: `${FRAME_H * SCALE}px`,
        transform: `translate(${anchorOffX}px, ${anchorOffY}px)`,
        transformOrigin: "center center",
        overflow: "visible",
        willChange: "transform",
      }}>
      <div
        ref={spriteRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
          willChange: "background-position",
        }}
      />
    </div>
  );
}

export default memo(PlayerSprite);
