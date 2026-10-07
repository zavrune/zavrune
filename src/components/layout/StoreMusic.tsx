"use client";

import React, { useEffect, useRef, useState } from "react";
import { Music, Pause, Play } from "lucide-react";

/** Optional storefront background music controlled from Admin → Store Settings. */
export function StoreMusic({ url, autoplay }: { url: string; autoplay: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!autoplay) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setBlocked(true));
  }, [autoplay, url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setBlocked(false);
        })
        .catch(() => setBlocked(true));
    }
  };

  return (
    <>
      <audio ref={audioRef} src={url} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-black/80 border border-white/20 text-white text-[10px] font-mono uppercase hover:border-white"
        aria-label={playing ? "Pause store music" : "Play store music"}
        title={blocked ? "Tap to start music" : undefined}
      >
        <Music className="w-3.5 h-3.5" />
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
    </>
  );
}
