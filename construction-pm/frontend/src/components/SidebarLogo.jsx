import React from "react";

const SidebarLogo = React.memo(() => {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "8px 12px",
        borderBottom: "1px solid #1E293B",
      }}
    >
      <img
        src="/navyakar-logo.png"
        alt="Navyakar"
        loading="eager"
        draggable="false"
        style={{
          width: "100%",
          maxWidth: "170px",
          height: "75px",
          objectFit: "contain",
          display: "block",
          margin: "0 auto",
          borderRadius: "8px",
          background: "#fff",
          padding: "4px 8px",

          /* 🔥 Stability fixes */
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          willChange: "transform",
        }}
      />
    </div>
  );
});

export default SidebarLogo;