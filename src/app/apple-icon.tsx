import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Generated PNG used as the iOS home-screen icon (no font needed — shapes only).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 96,
            height: 120,
            background: "#ffffff",
            borderRadius: 16,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 18,
              background: "#e0e7ff",
              borderTopLeftRadius: 16,
              borderBottomLeftRadius: 16,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              width: 30,
              height: 30,
              borderRadius: 15,
              background: "#f59e0b",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
