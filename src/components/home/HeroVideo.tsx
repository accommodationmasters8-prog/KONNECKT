'use client';

import { useEffect, useRef } from 'react';

/**
 * The hero footage, starting part-way in.
 *
 * The first seconds of the clip are a wind-up nobody arriving at a sign-in
 * page needs to sit through, so playback starts at `startAt` and loops back
 * there rather than to zero. Done in the player instead of by re-encoding:
 * the file stays untouched, there is no quality loss, and moving the start
 * point later is one number.
 *
 * `loop` is deliberately not set on the element — a native loop returns to
 * zero, which would replay exactly the part being skipped.
 */
export function HeroVideo({
  src,
  startAt = 7,
  className,
}: {
  src: string;
  startAt?: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // A short clip may be shorter than the offset asked for; seeking past the
    // end leaves a black frame rather than an error.
    const seekToStart = () => {
      const target = Number.isFinite(video.duration) && video.duration > startAt + 1
        ? startAt
        : 0;
      if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
    };

    // `loadedmetadata` is the first moment `duration` is known. If the browser
    // already has it — a cached file, a fast decode — the event never fires
    // again, so the seek has to happen now as well.
    if (video.readyState >= 1) seekToStart();
    video.addEventListener('loadedmetadata', seekToStart);
    video.addEventListener('ended', seekToStart);

    return () => {
      video.removeEventListener('loadedmetadata', seekToStart);
      video.removeEventListener('ended', seekToStart);
    };
  }, [startAt]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      autoPlay
      muted
      playsInline
      preload="metadata"
      // Restarts itself from `startAt` on `ended`, above.
      onEnded={(e) => { e.currentTarget.play().catch(() => {}); }}
    />
  );
}
