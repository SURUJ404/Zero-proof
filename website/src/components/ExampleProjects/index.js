import React from "react";
import styles from "./styles.module.css";

const projects = [
  { name: "Hello World", desc: "Prove a number is composite without revealing its factors", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/hello-world" },
  { name: "JSON", desc: "Prove contents of a JSON entry while keeping rest private", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/json" },
  { name: "Password Checker", desc: "Verify a password match without exposing the password", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/password-checker" },
  { name: "ECDSA", desc: "ECDSA signature verification in zero knowledge", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/ecdsa" },
  { name: "Digital Signature", desc: "Generic digital signature verification", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/digital-signature" },
  { name: "JWT Validator", desc: "Validate JWTs without revealing the token", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/jwt-validator" },
  { name: "SHA", desc: "Prove knowledge of a SHA preimage", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/sha" },
  { name: "Keccak", desc: "Prove knowledge of a Keccak preimage", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/keccak" },
  { name: "C-KZG", desc: "KZG polynomial commitments", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/c-kzg" },
  { name: "BN254", desc: "BN254 curve operations", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/bn254" },
  { name: "BLS12-381", desc: "BLS12-381 curve operations", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/bls12_381" },
  { name: "Groth16 Verifier", desc: "Verify Groth16 proofs in the zkVM", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/groth16-verifier" },
  { name: "Wordle", desc: "ZK proof that you solved a Wordle puzzle", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/wordle" },
  { name: "Chess", desc: "Prove a mate-in-one without revealing the move", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/chess" },
  { name: "Voting Machine", desc: "Private and verifiable voting", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/voting-machine" },
  { name: "ProRata", desc: "Pro rata distribution proofs", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/prorata" },
  { name: "XGBoost", desc: "Machine learning inference in the zkVM", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/xgboost" },
  { name: "SmartCore ML", desc: "ML model execution with SmartCore", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/smartcore-ml" },
  { name: "Composition", desc: "Compose multiple proofs into one", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/composition" },
  { name: "WASM", desc: "Run WebAssembly guests in the zkVM", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/wasm" },
  { name: "C Guest", desc: "Run C programs as zkVM guests", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/c-guest" },
  { name: "Browser Verify", desc: "Verify proofs directly in the browser", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/browser-verify" },
  { name: "Bevy", desc: "Game engine integration with the zkVM", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/bevy" },
  { name: "Profiling", desc: "Profile and optimize zkVM programs", url: "https://github.com/SURUJ404/Zero-proof/tree/main/examples/profiling" },
];

export default function ExampleProjects() {
  return (
    <section className={styles.section}>
      <div className="container">
        <h2 className={styles.heading}>Example Projects</h2>
        <p className={styles.subtitle}>
          Explore 24 ready-to-run examples showcasing what you can build with Zero Proof
        </p>
        <div className={styles.grid}>
          {projects.map((p, i) => (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className={styles.card}>
              <div className={styles.cardInner}>
                <h3 className={styles.cardTitle}>{p.name}</h3>
                <p className={styles.cardDesc}>{p.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
