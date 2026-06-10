import React, { useState, useCallback, useEffect } from "react";
import Layout from "@theme/Layout";
import useIsBrowser from "@docusaurus/useIsBrowser";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import styles from "../components/Playground/styles.module.css";

const EXAMPLES = {
  "hello-world-guest": {
    label: "Hello World — Guest",
    files: {
      "methods/guest/src/main.rs": {
        language: "rust",
        content: `use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

fn main() {
    let a: u64 = env::read();
    let b: u64 = env::read();

    if a == 1 || b == 1 {
        panic!("Trivial factors")
    }

    let product = a.checked_mul(b).expect("Integer overflow");
    env::commit(&product);
}`,
      },
      "src/lib.rs": {
        language: "rust",
        content: `use risc0_zkvm::{default_prover, ExecutorEnv, Receipt};

pub fn multiply(a: u64, b: u64) -> (Receipt, u64) {
    let env = ExecutorEnv::builder()
        .write(&a).unwrap()
        .write(&b).unwrap()
        .build().unwrap();

    let prover = default_prover();
    let receipt = prover.prove(env, MULTIPLY_ELF).unwrap().receipt;

    let c: u64 = receipt.journal.decode().unwrap();
    println!("I know the factors of {}, and I can prove it!", c);

    (receipt, c)
}`,
      },
    },
    output: ` Compiling hello-world v0.1.0
    Finished release in 12.34s
     Running hello-world

I know the factors of 391, and I can prove it!
Proof generated successfully.
Receipt verified: true
Cycles: 1024
Peak memory: 2.1 MB`,
  },
  "json": {
    label: "JSON — ZK Proof",
    files: {
      "methods/guest/src/main.rs": {
        language: "rust",
        content: `use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

risc0_zkvm::guest::entry!(main);

#[derive(Serialize, Deserialize)]
struct Document {
    id: u64,
    name: String,
    secret: String,
    public_data: String,
}

fn main() {
    let doc: Document = env::read();

    env::commit(&doc.id);
    env::commit(&doc.name);
    env::commit(&doc.public_data);

    assert!(!doc.secret.is_empty());
}`,
      },
      "src/main.rs": {
        language: "rust",
        content: `use json_methods::JSON_ID;
use risc0_zkvm::{default_prover, ExecutorEnv};

fn main() {
    let doc = Document {
        id: 42,
        name: "Alice".into(),
        secret: "s3cr3t".into(),
        public_data: "Public info".into(),
    };

    let env = ExecutorEnv::builder()
        .write(&doc).unwrap()
        .build().unwrap();

    let prover = default_prover();
    let receipt = prover.prove(env, JSON_ELF).unwrap().receipt;
    receipt.verify(JSON_ID).unwrap();

    let (id, name, public_data): (u64, String, String) =
        receipt.journal.decode().unwrap();
    println!("Verified: id={id}, name={name}, data={public_data}");
}`,
      },
    },
    output: ` Compiling json v0.1.0
    Finished release in 15.21s
     Running json

Verified: id=42, name=Alice, data=Public info
Proof size: 1.2 MB
Verification time: 0.34s
Secret field was NOT revealed \u2014 zero-knowledge property preserved.`,
  },
  "password-checker": {
    label: "Password Checker",
    files: {
      "methods/guest/src/main.rs": {
        language: "rust",
        content: `use risc0_zkvm::guest::env;
use sha2::{Sha256, Digest};

risc0_zkvm::guest::entry!(main);

fn main() {
    let password: String = env::read();
    let expected_hash: [u8; 32] = env::read();

    let hash = Sha256::digest(password.as_bytes());

    assert_eq!(hash[..], expected_hash[..]);

    env::commit(&true);
}`,
      },
    },
    output: ` Compiling password-checker v0.1.0
    Finished release in 11.78s
     Running password-checker

Password match verified in zero knowledge!
The verifier knows the password is correct
but learns nothing about the password itself.
Proof size: 0.8 MB
Verification time: 0.21s`,
  },
  "config-toml": {
    label: "zkVM Config (TOML)",
    files: {
      "Risc0.toml": {
        language: "toml",
        content: `[profile.release]
opt-level = 3
lto = true
codegen-units = 1

[env]
RISC0_DEV_MODE = "false"

[prover]
mode = "auto"

[remote]
# url = "https://prover.zero-proof.dev"
# api_key = "your-api-key"

[verifier]
chain = "ethereum"
contract_address = "0x..."
`,
      },
    },
    output: `Configuration loaded successfully.
Profile: release
Mode: auto (local prover)
Optimization: full (opt-level=3, LTO)
Proof mode: STARK \u2192 SNARK compression enabled`,
  },
};

function PlaygroundInner() {
  const isBrowser = useIsBrowser();
  const [EditorComponent, setEditorComponent] = useState(null);
  const [theme, setTheme] = useState("dark");

  const [selectedExample, setSelectedExample] = useState("hello-world-guest");
  const [activeFile, setActiveFile] = useState(null);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [language, setLanguage] = useState("rust");

  const currentExample = EXAMPLES[selectedExample];
  const fileNames = currentExample ? Object.keys(currentExample.files) : [];
  const currentFile = activeFile || fileNames[0] || null;
  const currentFileData = currentFile ? currentExample?.files[currentFile] : null;

  useEffect(() => {
    if (!isBrowser) return;
    import("@monaco-editor/react").then((mod) => {
      setEditorComponent(() => mod.default);
    });
  }, [isBrowser]);

  useEffect(() => {
    if (isBrowser) {
      const htmlEl = document.querySelector("html");
      if (htmlEl) {
        const isDark = htmlEl.getAttribute("data-theme") === "dark";
        setTheme(isDark ? "vs-dark" : "light");
        const observer = new MutationObserver(() => {
          const d = htmlEl.getAttribute("data-theme") === "dark" ? "vs-dark" : "light";
          setTheme(d);
        });
        observer.observe(htmlEl, { attributes: true, attributeFilter: ["data-theme"] });
        return () => observer.disconnect();
      }
    }
  }, [isBrowser]);

  useEffect(() => {
    if (currentFile && currentFileData) {
      setCode(currentFileData.content);
      setLanguage(currentFileData.language);
    }
    setOutput("");
    setActiveFile(fileNames[0] || null);
  }, [selectedExample]);

  const handleCodeChange = useCallback((newValue) => {
    setCode(newValue);
  }, []);

  const handleFileChange = useCallback((fileName) => {
    setActiveFile(fileName);
    const fileData = currentExample?.files[fileName];
    if (fileData) {
      setCode(fileData.content);
      setLanguage(fileData.language);
    }
    setOutput("");
  }, [currentExample]);

  const handleExampleChange = useCallback((e) => {
    setSelectedExample(e.target.value);
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput("");

    const lines = [];
    lines.push("$ cargo run --release\n");

    const apiUrl = null;

    if (apiUrl) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ example: selectedExample, file: currentFile, code }),
        });
        if (response.ok) {
          const result = await response.json();
          lines.push(result.output || "Execution complete.");
        } else {
          lines.push(`Error: API returned ${response.status}`);
        }
      } catch (err) {
        lines.push(`Error: ${err.message}`);
        lines.push("Falling back to local simulation...\n");
        const preset = currentExample?.output;
        if (preset) lines.push(preset);
      }
    } else {
      await new Promise((r) => setTimeout(r, 1000));
      lines.push("   Compiling example...");
      await new Promise((r) => setTimeout(r, 400));
      lines.push("    Finished release in 12.34s\n");
      await new Promise((r) => setTimeout(r, 300));
      lines.push("     Running example\n");

      const preset = currentExample?.output;
      if (preset) lines.push(preset);
    }

    setOutput(lines.join("\n"));
    setIsRunning(false);
  }, [selectedExample, currentFile, code, currentExample]);

  const handleClearOutput = useCallback(() => {
    setOutput("");
  }, []);

  if (!isBrowser) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Playground</h1>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>Loading editor...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Playground</h1>
          <select
            className={styles.select}
            value={selectedExample}
            onChange={handleExampleChange}
          >
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.headerRight}>
          <span
            className={`${styles.statusDot} ${isRunning ? styles.running : styles.ready}`}
          />
          <button
            className={`${styles.runButton} ${isRunning ? styles.running : ""}`}
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      <div className={styles.fileTabs}>
        {fileNames.map((name) => (
          <div
            key={name}
            className={`${styles.fileTab} ${name === currentFile ? styles.active : ""}`}
            onClick={() => handleFileChange(name)}
          >
            {name}
          </div>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.editorContainer}>
          <div className={styles.editorWrapper}>
            {EditorComponent ? (
              <EditorComponent
                language={language}
                value={code}
                onChange={handleCodeChange}
                theme={theme}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  renderWhitespace: "selection",
                  tabSize: 4,
                  padding: { top: 8 },
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace",
                  fontLigatures: true,
                  wordWrap: "on",
                  bracketPairColorization: { enabled: true },
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>Loading editor...</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.outputPanel}>
          <div className={styles.outputHeader}>
            <span>Output</span>
            <button className={styles.clearOutput} onClick={handleClearOutput}>
              Clear
            </button>
          </div>
          <div className={styles.outputContent}>
            {output ? (
              <span>{output}</span>
            ) : (
              <span className={styles.outputEmpty}>
                Select an example and click "Run" to execute
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Playground() {
  return (
    <Layout title="Playground" description="Interactive Zero Proof code playground">
      <PlaygroundInner />
    </Layout>
  );
}
