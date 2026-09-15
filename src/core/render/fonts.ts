/**
 * The chart font must render identically in the main-thread preview and the
 * export worker's OffscreenCanvas, so both load the same files from /public.
 * Keep in sync with the @font-face rules in src/app/globals.css.
 */
export const CHART_FONT_FAMILY = "Inter Chart";

export const CHART_FONT_FILES: { url: string; unicodeRange: string }[] = [
  {
    url: "/fonts/inter-latin-wght-normal.woff2",
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    url: "/fonts/inter-latin-ext-wght-normal.woff2",
    unicodeRange:
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
];

/** CSS font shorthand for the chart font at a given weight/size. */
export function chartFont(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px "${CHART_FONT_FAMILY}", system-ui, sans-serif`;
}

/**
 * Register and load the chart font into a FontFaceSet (`document.fonts` or
 * a worker's `self.fonts`). Safe to call repeatedly.
 */
export async function loadChartFonts(
  fonts: FontFaceSet,
  baseUrl: string,
): Promise<void> {
  const faces = CHART_FONT_FILES.map(
    (f) =>
      new FontFace(CHART_FONT_FAMILY, `url(${new URL(f.url, baseUrl).href})`, {
        weight: "100 900",
        style: "normal",
        display: "block",
        unicodeRange: f.unicodeRange,
      }),
  );
  await Promise.all(
    faces.map(async (face) => {
      await face.load();
      fonts.add(face);
    }),
  );
}
