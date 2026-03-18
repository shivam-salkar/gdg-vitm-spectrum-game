import { useRef, useCallback, useEffect } from "react";

export function useSound() {
  const audioCtxRef = useRef(null);

  useEffect(() => {
    // Lazy init audio context on first use to comply with browser autoplay policies
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
    };
    window.addEventListener("pointerdown", initAudio, { once: true });
    return () => window.removeEventListener("pointerdown", initAudio);
  }, []);

  const playTone = useCallback(
    (type, startFreq, endFreq, duration, vol = 0.1) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        endFreq,
        ctx.currentTime + duration,
      );

      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + duration,
      );

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [],
  );

  const swordClash = useCallback(() => {
    playTone("sawtooth", 440, 200, 0.15, 0.2);
  }, [playTone]);

  const enemyDeath = useCallback(() => {
    playTone("square", 200, 80, 0.4, 0.3);
  }, [playTone]);

  const victory = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const playNote = (f, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.3);
    };

    const t = ctx.currentTime;
    playNote(440, t);
    playNote(554.37, t + 0.15);
    playNote(659.25, t + 0.3);
  }, []);

  const fightMusicRef = useRef(null);

  const startFightMusic = useCallback(() => {
    if (fightMusicRef.current) return;
    const audio = new Audio("/assets/fight.ogg");
    audio.loop = true;
    audio.volume = 0.4;
    audio.play().catch((e) => console.log("Audio play failed:", e));
    fightMusicRef.current = audio;
  }, []);

  const stopFightMusic = useCallback(() => {
    if (fightMusicRef.current) {
      fightMusicRef.current.pause();
      fightMusicRef.current.currentTime = 0;
      fightMusicRef.current = null;
    }
  }, []);

  const pauseFightMusic = useCallback(() => {
    if (fightMusicRef.current) {
      fightMusicRef.current.pause();
    }
  }, []);

  const resumeFightMusic = useCallback(() => {
    if (fightMusicRef.current) {
      fightMusicRef.current.play().catch((e) => console.log(e));
    }
  }, []);

  const ambientWindRef = useRef(null);

  const startAmbientWind = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ambientWindRef.current) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.05;

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start();
    ambientWindRef.current = noise;
  }, []);

  const stopAmbientWind = useCallback(() => {
    if (ambientWindRef.current) {
      ambientWindRef.current.stop();
      ambientWindRef.current = null;
    }
  }, []);

  return {
    swordClash,
    enemyDeath,
    victory,
    startAmbientWind,
    stopAmbientWind,
    startFightMusic,
    stopFightMusic,
    pauseFightMusic,
    resumeFightMusic,
  };
}

// Keep old name for backwards compatibility
export const usePixiSound = useSound;
