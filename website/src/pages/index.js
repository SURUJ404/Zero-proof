import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import ExampleProjects from "@site/src/components/ExampleProjects";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--dark", styles.heroBanner)}>
      <div className="container">
        <h1 className={styles.heroTitle}>ZERO PROOF</h1>
        <p className={styles.heroSubtitle}>
          A verifiable RISC-V computer that lets you write ZK proofs like any other code
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/proof-system/">
            Get Started
          </Link>
          <Link className="button button--secondary button--lg" to="https://github.com/SURUJ404/Zero-proof">
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <Layout description="Zero Proof — a verifiable RISC-V computer for ZK proofs">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <ExampleProjects />
      </main>
    </Layout>
  );
}
