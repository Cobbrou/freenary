const PINK_GRADIENT = [
  "radial-gradient(circle at 18% 12%, #fdf2f8 0%, transparent 55%)",
  "radial-gradient(circle at 88% 30%, #fbcfe8 0%, transparent 50%)",
  "radial-gradient(circle at 30% 95%, #f472b6 0%, transparent 60%)",
  "linear-gradient(160deg, #fce7f3 0%, #f9a8d4 55%, #f472b6 100%)",
].join(", ");

export const PinkBackdrop = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
    style={{ backgroundImage: PINK_GRADIENT }}
  >
    <div className="absolute inset-0 dark:bg-black/45" />
  </div>
);
