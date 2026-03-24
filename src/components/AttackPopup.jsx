import React, { useState } from "react";
import "../game.css";

export default function AttackPopup({ visible, enabled = true, onClick }) {
  const [isPressed, setIsPressed] = useState(false);
  const scale = visible ? 1 : 0;

  const handlePress = () => {
    if (!visible || !enabled) return;
    setIsPressed(true);

    // Visual feedback delay before triggering
    setTimeout(() => {
      setIsPressed(false);
      if (onClick) onClick();
    }, 150);
  };

  return (
    <div
      className="attack-popup-container"
      style={{
        position: "absolute",
        bottom: "40px",
        right: "40px",
        transform: `translateZ(0) scale(${scale})`,
        transformOrigin: "bottom right",
        transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        pointerEvents: visible && enabled ? "auto" : "none",
        opacity: enabled ? 1 : 0.55,
        zIndex: 1000,
        willChange: "transform",
        touchAction: "manipulation",
      }}
      onMouseDown={handlePress}
      onTouchStart={handlePress}
    >
      <div
        style={{
          width: "100px",
          height: "100px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: enabled ? "pointer" : "not-allowed",
          transform: isPressed
            ? "translateZ(0) scale(0.85)"
            : "translateZ(0) scale(1)",
          filter: isPressed
            ? "grayscale(1) brightness(0.6)"
            : enabled
              ? "none"
              : "grayscale(1) brightness(0.8)",
          transition: "transform 0.1s ease-out, filter 0.1s ease-out",
        }}
      >
        <img
          src="/assets/sword_button.webp"
          alt="Attack"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}
