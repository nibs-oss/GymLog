import { ImageResponse } from "next/og";

// App icons for the PWA manifest / home screen: /icons/192.png, /icons/512.png,
// /icons/maskable-512.png, /icons/apple-180.png
const SIZES: Record<string, { size: number; maskable?: boolean; square?: boolean }> = {
  "192.png": { size: 192 },
  "512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true, square: true },
  "apple-180.png": { size: 180, square: true },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = SIZES[file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable, square } = spec;
  // Maskable icons keep the mark inside the central 80% safe zone
  const mark = Math.round(size * (maskable ? 0.42 : 0.56));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7dd3fc 0%, #0ea5e9 100%)",
          borderRadius: square ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            fontSize: mark,
            fontWeight: 800,
            color: "#07111f",
            lineHeight: 1,
            marginTop: -size * 0.02,
          }}
        >
          G
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
