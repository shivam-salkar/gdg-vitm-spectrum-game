import React, { useRef, useEffect, useState } from "react";
import "../game.css";

const ANIMATIONS = {
  idle: { url: "/assets/Samurai_Commander/Idle.png", frames: 5, speed: 0.03 },
  walk: { url: "/assets/Samurai_Commander/Walk.png", frames: 9, speed: 0.1 },
  run: { url: "/assets/Samurai_Commander/Run.png", frames: 8, speed: 0.15 },
  attack1: {
    url: "/assets/Samurai_Commander/Attack_1.png",
    frames: 4,
    speed: 0.15,
  },
  attack2: {
    url: "/assets/Samurai_Commander/Attack_2.png",
    frames: 5,
    speed: 0.15,
  },
  attack3: {
    url: "/assets/Samurai_Commander/Attack_3.png",
    frames: 4,
    speed: 0.15,
  },
  protect: {
    url: "/assets/Samurai_Commander/Protect.png",
    frames: 2,
    speed: 0.03,
  },
  hit: { url: "/assets/Samurai_Commander/Hurt.png", frames: 2, speed: 0.15 },
  death: { url: "/assets/Samurai_Commander/Dead.png", frames: 6, speed: 0.1 },
};

export default function EnemySprite({
  x,
  y,
  scale = 3,
  phase = "idle",
  anchor = 0.5,
  isFlash = false,
}) {
  const currentAction = ANIMATIONS[phase] || ANIMATIONS.idle;
  const [isLoaded, setIsLoaded] = useState(false);
  const spriteRef = useRef(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.src = currentAction.url;
  }, [currentAction.url]);

  // Reset frame when phase changes
  useEffect(() => {
    frameRef.current = 0;
    timeRef.current = 0;
  }, [phase]);

  useEffect(() => {
    if (!isLoaded || !spriteRef.current) return;

    let animationId;

    const animate = () => {
      timeRef.current += 1;

      // Advance frame based on speed
      if (timeRef.current >= 1 / currentAction.speed) {
        let nextFrame = frameRef.current + 1;
        if (phase === "death" && nextFrame >= currentAction.frames) {
          nextFrame = currentAction.frames - 1; // Stay on last frame
        } else {
          nextFrame = nextFrame % currentAction.frames;
        }
        frameRef.current = nextFrame;
        timeRef.current = 0;
      }

      const frameWidth = 128;
      const offsetX = frameRef.current * frameWidth * scale;

      if (spriteRef.current) {
        spriteRef.current.style.backgroundPositionX = `-${offsetX}px`;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isLoaded, currentAction.frames, currentAction.speed, scale]);

  const frameWidth = 128;
  const frameHeight = 128;
  const totalWidth = frameWidth * currentAction.frames;

  const offsetX = -frameWidth * anchor;
  const offsetY = -frameHeight * anchor;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${frameWidth * scale}px`,
        height: `${frameHeight * scale}px`,
        transform: `translate(${offsetX * scale}px, ${offsetY * scale}px) scaleX(-1)`,
        overflow: "visible",
        filter: isFlash ? "brightness(1.5)" : "brightness(1)",
        transition: isFlash ? "filter 0.1s" : "filter 0.2s",
      }}>
      {isLoaded && (
        <div
          ref={spriteRef}
          style={{
            backgroundImage: `url('${currentAction.url}')`,
            backgroundSize: `${totalWidth * scale}px ${frameHeight * scale}px`,
            backgroundPosition: "0 0",
            backgroundRepeat: "no-repeat",
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
          }}
        />
      )}
    </div>
  );
}
