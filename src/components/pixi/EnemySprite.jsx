import React, { useMemo, useRef, useEffect } from "react";
import { Container, useTick } from "@pixi/react";
import { getSpriteFrames } from "../../pixiUtils";
import * as PIXI from "pixi.js";

const ANIMATIONS = {
  idle: { url: "/assets/Samurai_Commander/Idle.webp", frames: 5 },
  walk: { url: "/assets/Samurai_Commander/Walk.webp", frames: 9 },
  attacking: { url: "/assets/Samurai_Commander/Attack_1.webp", frames: 4 },
  hit: { url: "/assets/Samurai_Commander/Hurt.webp", frames: 2 },
  death: { url: "/assets/Samurai_Commander/Dead.webp", frames: 6 },
};

export default function EnemySprite({
  x,
  y,
  scale = 2,
  phase = "idle",
  anchor = 0.5,
  isFlash = false,
}) {
  const currentAction = ANIMATIONS[phase] || ANIMATIONS.idle;

  const textures = useMemo(() => {
    return getSpriteFrames(currentAction.url, currentAction.frames);
  }, [currentAction.url, currentAction.frames]);

  const frameIndex = useRef(0);
  const time = useRef(0);
  const containerRef = useRef(null);
  const spriteRef = useRef(null);
  const isDestroyed = useRef(false);

  const isDead = phase === "death";
  const speed = phase === "hit" ? 0.2 : 0.15;

  // Initialize raw PIXI.Sprite to bypass @pixi/react strict instanceof texture checks
  useEffect(() => {
    isDestroyed.current = false;
    if (!containerRef.current) return;
    const sprite = new PIXI.Sprite(textures[0]);
    sprite.anchor.set(anchor);
    sprite.scale.set(-scale, scale); // Flip left natively

    spriteRef.current = sprite;
    containerRef.current.addChild(sprite);

    return () => {
      isDestroyed.current = true;
      // Don't manually destroy - @pixi/react Container will handle cleanup
      // Manual destroy() calls trigger harmless but noisy errors from @pixi/react internals
    };
  }, []); // Only on mount

  // Sync props and textures
  useEffect(() => {
    if (spriteRef.current && !isDestroyed.current) {
      spriteRef.current.anchor.set(anchor);
      spriteRef.current.scale.set(-scale, scale);
    }
    frameIndex.current = 0;
    time.current = 0;
  }, [phase, anchor, scale]);

  useTick((delta) => {
    if (isDestroyed.current || !spriteRef.current || !textures.length) return;

    try {
      // Handle tint
      spriteRef.current.tint = isFlash ? 0xff0000 : 0xffffff;

      time.current += speed * delta;
      if (time.current >= 1) {
        time.current -= 1;
        let next = frameIndex.current + 1;
        if (next >= textures.length) {
          next = isDead ? textures.length - 1 : 0;
        }
        frameIndex.current = next;
        spriteRef.current.texture = textures[frameIndex.current] || textures[0];
      }
    } catch (e) {
      // Sprite destroyed or textures not ready
    }
  });

  return <Container ref={containerRef} x={x} y={y} />;
}
