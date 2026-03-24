import React, { useRef, useEffect, memo } from "react";
import "../game.css";
import {
  PLAYER_ANIMATIONS,
  SPRITE_DIMENSIONS,
} from "../constants/sprites.js";

const { FRAME_WIDTH, FRAME_HEIGHT, SCALE, HALF_WIDTH, HALF_HEIGHT } =
  SPRITE_DIMENSIONS;

function PlayerSprite({ x, y, phase = "idle", freeze = false }) {
  const anim = PLAYER_ANIMATIONS[phase] || PLAYER_ANIMATIONS.idle;
  const { url, frames, fps } = anim;
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
    if (el) {
      el.style.backgroundImage = `url('${url}')`;
      el.style.backgroundSize = `${frames * FRAME_WIDTH * SCALE}px ${FRAME_HEIGHT * SCALE}px`;
    }
  }, [frames, url]);

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
            el.style.backgroundPositionX = `-${s.frame * FRAME_WIDTH * SCALE}px`;
          }
        }
      }

      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [fps, frames, phase, freeze]);

  const anchorOffX = -HALF_WIDTH;
  const anchorOffY = -HALF_HEIGHT;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${FRAME_WIDTH * SCALE}px`,
        height: `${FRAME_HEIGHT * SCALE}px`,
        transform: `translate3d(${anchorOffX}px, ${anchorOffY}px, 0)`,
        transformOrigin: "center center",
        overflow: "visible",
        willChange: "transform",
        backfaceVisibility: "hidden",
        contain: "layout paint",
      }}>
      <div
        className="sprite"
        ref={spriteRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
          transform: "translateZ(0)",
          willChange: "background-position, transform",
        }}
      />
    </div>
  );
}

export default memo(PlayerSprite);
