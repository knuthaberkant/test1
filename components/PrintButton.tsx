"use client";

export default function PrintButton() {
  return (
    <button className="btn-secondary" onClick={() => window.print()}>
      Als PDF speichern
    </button>
  );
}
