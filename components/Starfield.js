"use client";

import { useEffect, useRef } from "react";

// พื้นหลังผงทอง/ประกายดาวลอยระยิบระยับ วาดด้วย canvas (เบา ลื่น)
export default function Starfield() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w, h, dpr;
    let raf;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const COLORS = ["#d4af37", "#e6c976", "#c8a2e8", "#f0d9a8", "#b8860b"];
    let particles = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round((w * h) / 14000); // ความหนาแน่นตามขนาดจอ
      particles = Array.from({ length: count }, () => spawn());
    }

    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.2 + 0.4,
        vy: -(Math.random() * 0.35 + 0.06), // ลอยขึ้นช้าๆ
        vx: (Math.random() - 0.5) * 0.25,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        tw: Math.random() * Math.PI * 2, // เฟสการกะพริบ
        twSpeed: Math.random() * 0.03 + 0.008,
        baseA: Math.random() * 0.5 + 0.2,
      };
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += p.twSpeed;
        // วนขึ้นบนแล้วโผล่ล่างใหม่
        if (p.y < -6) {
          p.y = h + 6;
          p.x = Math.random() * w;
        }
        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;

        const a = p.baseA * (0.55 + 0.45 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    resize();
    if (reduce) {
      // ถ้าผู้ใช้ปิดแอนิเมชัน วาดครั้งเดียวแบบนิ่ง
      frame();
      cancelAnimationFrame(raf);
    } else {
      frame();
    }
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
