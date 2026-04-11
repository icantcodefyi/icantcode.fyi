import { useEffect, useState } from "react";

/**
 * Oneko — the classic cat that follows your cursor.
 *
 * Ported from adryd325/oneko.js (CC0). Only active when cat-mode is
 * turned on via the Konami code (KonamiMode sets `data-cat-mode="true"`
 * on <html>). We watch that attribute with a MutationObserver so the
 * cat spawns/despawns without either component knowing about the other.
 *
 *  • Disabled on coarse pointers and prefers-reduced-motion
 *  • Skips SSR
 *  • Cycles through 16 sprite frames for direction + idle states
 *  • Falls asleep if the tab is hidden for 5 minutes — wakes up on
 *    focus return. "Idle state, but for attention." (/delight)
 */

const AFK_SLEEP_MS = 5 * 60 * 1000;
export function Oneko() {
  const [active, setActive] = useState(false);

  // Sync with <html data-cat-mode>
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const read = () => setActive(root.dataset.catMode === "true");
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["data-cat-mode"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (document.getElementById("oneko")) return;

    const nekoEl = document.createElement("div");
    nekoEl.id = "oneko";
    nekoEl.ariaHidden = "true";
    nekoEl.style.cssText = `
      width: 32px;
      height: 32px;
      position: fixed;
      pointer-events: none;
      image-rendering: pixelated;
      left: 16px;
      top: 16px;
      z-index: 9998;
      background-image: url("/oneko.gif");
    `;
    document.body.appendChild(nekoEl);

    let nekoPosX = 32;
    let nekoPosY = 32;
    let mousePosX = window.innerWidth / 2;
    let mousePosY = window.innerHeight / 2;
    let frameCount = 0;
    let idleTime = 0;
    let idleAnimation: string | null = null;
    let idleAnimationFrame = 0;
    const nekoSpeed = 10;

    // AFK sleep state — tracked separately from the random idle above
    // so it overrides whatever the cat was doing. When asleep, the
    // `frame` tick short-circuits to a sleep sprite.
    let afkAsleep = false;
    let afkTimer: ReturnType<typeof setTimeout> | null = null;

    function clearAfkTimer() {
      if (afkTimer != null) {
        clearTimeout(afkTimer);
        afkTimer = null;
      }
    }
    function sleepAfk() {
      afkAsleep = true;
      idleAnimation = "sleeping";
      idleAnimationFrame = 32; // skip "tired" frames, go straight to Zs
    }
    function wakeAfk() {
      afkAsleep = false;
      clearAfkTimer();
      idleAnimation = null;
      idleAnimationFrame = 0;
      idleTime = 0;
    }
    function onVisibility() {
      if (document.hidden) {
        clearAfkTimer();
        afkTimer = setTimeout(() => {
          if (document.hidden) sleepAfk();
        }, AFK_SLEEP_MS);
      } else {
        wakeAfk();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    const spriteSets: Record<string, [number, number][]> = {
      idle: [[-3, -3]],
      alert: [[-7, -3]],
      scratchSelf: [
        [-5, 0],
        [-6, 0],
        [-7, 0],
      ],
      scratchWallN: [
        [0, 0],
        [0, -1],
      ],
      scratchWallS: [
        [-7, -1],
        [-6, -2],
      ],
      scratchWallE: [
        [-2, -2],
        [-2, -3],
      ],
      scratchWallW: [
        [-4, 0],
        [-4, -1],
      ],
      tired: [[-3, -2]],
      sleeping: [
        [-2, 0],
        [-2, -1],
      ],
      N: [
        [-1, -2],
        [-1, -3],
      ],
      NE: [
        [0, -2],
        [0, -3],
      ],
      E: [
        [-3, 0],
        [-3, -1],
      ],
      SE: [
        [-5, -1],
        [-5, -2],
      ],
      S: [
        [-6, -3],
        [-7, -2],
      ],
      SW: [
        [-5, -3],
        [-6, -1],
      ],
      W: [
        [-4, -2],
        [-4, -3],
      ],
      NW: [
        [-1, 0],
        [-1, -1],
      ],
    };

    function onMove(e: PointerEvent) {
      mousePosX = e.clientX;
      mousePosY = e.clientY;
    }
    document.addEventListener("pointermove", onMove, { passive: true });

    function setSprite(name: string, frame: number) {
      const sprite = spriteSets[name][frame % spriteSets[name].length];
      nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
    }

    function resetIdle() {
      idleAnimation = null;
      idleAnimationFrame = 0;
    }

    function idle() {
      idleTime += 1;
      if (
        idleTime > 10 &&
        Math.floor(Math.random() * 200) === 0 &&
        idleAnimation === null
      ) {
        const availableIdleAnimations = ["sleeping", "scratchSelf"];
        if (nekoPosX < 32) availableIdleAnimations.push("scratchWallW");
        if (nekoPosY < 32) availableIdleAnimations.push("scratchWallN");
        if (nekoPosX > window.innerWidth - 32) availableIdleAnimations.push("scratchWallE");
        if (nekoPosY > window.innerHeight - 32) availableIdleAnimations.push("scratchWallS");
        idleAnimation =
          availableIdleAnimations[Math.floor(Math.random() * availableIdleAnimations.length)];
      }

      switch (idleAnimation) {
        case "sleeping":
          if (idleAnimationFrame < 8) {
            setSprite("tired", 0);
            break;
          }
          setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
          if (idleAnimationFrame > 192) resetIdle();
          break;
        case "scratchWallN":
        case "scratchWallS":
        case "scratchWallE":
        case "scratchWallW":
        case "scratchSelf":
          setSprite(idleAnimation, idleAnimationFrame);
          if (idleAnimationFrame > 9) resetIdle();
          break;
        default:
          setSprite("idle", 0);
          return;
      }
      idleAnimationFrame += 1;
    }

    function frame() {
      frameCount += 1;

      // AFK overrides everything — stay curled up until the tab returns
      if (afkAsleep) {
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        idleAnimationFrame += 1;
        return;
      }

      const diffX = nekoPosX - mousePosX;
      const diffY = nekoPosY - mousePosY;
      const distance = Math.sqrt(diffX * diffX + diffY * diffY);

      if (distance < nekoSpeed || distance < 48) {
        idle();
        return;
      }

      idleAnimation = null;
      idleAnimationFrame = 0;

      if (idleTime > 1) {
        setSprite("alert", 0);
        idleTime = Math.min(idleTime, 7);
        idleTime -= 1;
        return;
      }

      let direction = "";
      direction += diffY / distance > 0.5 ? "N" : "";
      direction += diffY / distance < -0.5 ? "S" : "";
      direction += diffX / distance > 0.5 ? "W" : "";
      direction += diffX / distance < -0.5 ? "E" : "";
      setSprite(direction, frameCount);

      nekoPosX -= (diffX / distance) * nekoSpeed;
      nekoPosY -= (diffY / distance) * nekoSpeed;

      nekoPosX = Math.min(Math.max(16, nekoPosX), window.innerWidth - 16);
      nekoPosY = Math.min(Math.max(16, nekoPosY), window.innerHeight - 16);

      nekoEl.style.left = `${nekoPosX - 16}px`;
      nekoEl.style.top = `${nekoPosY - 16}px`;
    }

    const interval = setInterval(frame, 100);

    return () => {
      clearInterval(interval);
      clearAfkTimer();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      nekoEl.remove();
    };
  }, [active]);

  return null;
}
