"use client";

import { useEffect, useRef, useState } from "react";

/** Canvas signature field. Calls onChange with a PNG data URL, or null when cleared. */
export default function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#1d1d1f";
      setEmpty(true);
      onChange(null);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white">
        <canvas
          ref={canvasRef}
          className="block h-44 w-full touch-none md:h-52"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = "#1d1d1f";
            ctx.fill();
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = point(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = false;
            setEmpty(false);
            onChange(canvasRef.current!.toDataURL("image/png"));
          }}
          onPointerCancel={() => (drawing.current = false)}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-black/20" />
        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] text-black/30">
            Hier unterschreiben
          </div>
        )}
      </div>
      <div className="mt-2 text-right">
        <button
          type="button"
          className="text-[14px] text-link disabled:opacity-40"
          disabled={empty}
          onClick={() => {
            const c = canvasRef.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange(null);
          }}
        >
          Löschen
        </button>
      </div>
    </div>
  );
}
