import { ImageResponse } from "next/og";

export const alt = "Cash Flow Forecaster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
        }}
      >
        <svg width="200" height="200" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="26" fill="none" stroke="#ffffff" strokeWidth="6" />
          <polyline
            points="35,57 48,41 61,57"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: "#ffffff" }}>Cash Flow Forecaster</div>
          <div style={{ fontSize: 30, color: "#d1fae5", marginTop: 18 }}>
            Weekly cash flow forecasting for your business
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
