import React, { useRef, useEffect, useState } from "react";
import "../game.css";

const ANIMATIONS = {
  idle: { url: "/assets/Samurai/Idle.png", frames: 6, speed: 0.03 },
  walk: { url: "/assets/Samurai/Walk.png", frames: 9, speed: 0.1 },
  run: { url: "/assets/Samurai/Run.png", frames: 8, speed: 0.15 },
  attack1: { url: "/assets/Samurai/Attack_1.png", frames: 4, speed: 0.05 },
  attack2: { url: "/assets/Samurai/Attack_2.png", frames: 5, speed: 0.05 },
  attack3: { url: "/assets/Samurai/Attack_3.png", frames: 4, speed: 0.05 },
  protect: { url: "/assets/Samurai/Protection.png", frames: 3, speed: 0.1 },
  death: { url: "/assets/Samurai/Dead.png", frames: 6, speed: 0.1 },
};

export default function PlayerSprite({
  x,
  y,
  scale = 3,
  phase = "idle",
  anchor = 0.5,
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
        frameRef.current = (frameRef.current + 1) % currentAction.frames;
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
        transform: `translate(${offsetX * scale}px, ${offsetY * scale}px)`,
        overflow: "visible",
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
