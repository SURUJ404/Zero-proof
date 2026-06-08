import React from "react";

const Home = () => {
  return (
    <div
      style={{
        backgroundColor: "#000000",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
        padding: 0,
      }}
    >
      <h1
        style={{
          color: "#ffffff",
          fontSize: "clamp(3rem, 10vw, 8rem)",
          fontWeight: 300,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          margin: 0,
          userSelect: "none",
        }}
      >
        ZERO PROOF
      </h1>
    </div>
  );
};

export default Home;
