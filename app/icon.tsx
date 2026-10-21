import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: "linear-gradient(145deg, #16a394, #0d4e46)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
