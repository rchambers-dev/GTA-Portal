"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";

/**
 * Converts vertical mouse-wheel / trackpad scrolling into horizontal scroll
 * while the pointer is over this region (when content overflows).
 */
export const HorizontalScrollRegion = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
  }
>(function HorizontalScrollRegion({ children, className }, ref) {
  const localRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.deltaY === 0) return;

      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={localRef} className={className}>
      {children}
    </div>
  );
});
