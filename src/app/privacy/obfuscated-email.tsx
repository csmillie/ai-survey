"use client";

import { useCallback, useState } from "react";

const PARTS = ["privacy", "modeltrust.ai"] as const;

export function ObfuscatedEmail(): React.ReactElement {
  const [revealed, setRevealed] = useState(false);

  const handleClick = useCallback(() => {
    setRevealed(true);
    const addr = `${PARTS[0]}@${PARTS[1]}`;
    window.location.href = `mailto:${addr}`;
  }, []);

  if (revealed) {
    const addr = `${PARTS[0]}@${PARTS[1]}`;
    return (
      <a
        href={`mailto:${addr}`}
        className="text-zinc-50 underline hover:text-zinc-300"
      >
        {addr}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-zinc-50 underline hover:text-zinc-300 cursor-pointer"
    >
      privacy [at] modeltrust.ai
    </button>
  );
}
