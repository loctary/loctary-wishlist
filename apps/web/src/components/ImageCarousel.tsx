import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconGift } from "@tabler/icons-react";

/**
 * Card-cover carousel. CSS scroll-snap does the heavy lifting (touch, wheel,
 * scrollbar all work for free); the buttons just programmatically scroll one
 * slide. Index 0 is the cover, which is what the parent renders first if it
 * only ever shows a thumbnail.
 *
 * Tint colour is applied by the parent (`bg`/`fg`) so we keep the existing
 * empty-state look (icon over the per-item pastel).
 */
export function ImageCarousel({
  images,
  alt,
  bg,
  fg,
  icon,
}: {
  images: string[];
  alt: string;
  bg: string;
  fg: string;
  /** Empty-state glyph shown over the tint when there are no images. */
  icon?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Track which slide is centred (driven by scroll, not just our clicks — keeps
  // the dots accurate when the user drags or swipes).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track.clientWidth || 1;
        setIndex(Math.round(track.scrollLeft / w));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => (e: React.MouseEvent) => {
      // The carousel is inside a Link — don't navigate when clicking an arrow.
      e.preventDefault();
      e.stopPropagation();
      const track = trackRef.current;
      if (!track) return;
      const w = track.clientWidth || 1;
      track.scrollTo({ left: (index + dir) * w, behavior: "smooth" });
    },
    [index],
  );

  if (images.length === 0) {
    return (
      <div className="wl-cover" style={{ background: bg, color: fg }}>
        {icon ?? <IconGift size={54} style={{ color: fg }} />}
      </div>
    );
  }

  return (
    <div className="wl-carousel" style={{ background: bg }}>
      <div className="wl-carousel-track" ref={trackRef}>
        {images.map((url, i) => (
          <div key={url} className="wl-carousel-slide">
            <img src={url} alt={i === 0 ? alt : `${alt} (${i + 1})`} draggable={false} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="wl-carousel-arrow"
            data-side="left"
            disabled={index === 0}
            onClick={go(-1)}
            aria-label="Previous image"
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="wl-carousel-arrow"
            data-side="right"
            disabled={index === images.length - 1}
            onClick={go(1)}
            aria-label="Next image"
          >
            <IconChevronRight size={18} />
          </button>
          <div className="wl-carousel-dots" aria-hidden>
            {images.map((url, i) => (
              <span key={url} data-active={i === index ? "true" : undefined} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
