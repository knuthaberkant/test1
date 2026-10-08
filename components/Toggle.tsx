"use client";

export default function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-4">
      <span className="flex-1">
        <span className="block text-[16px]">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? "bg-ok" : "bg-line"}`}
      >
        <span className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </label>
  );
}
