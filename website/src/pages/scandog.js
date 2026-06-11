import React from "react";
import Layout from "@theme/Layout";
import ScanDog from "../components/ScanDog";

export default function ScanDogPage() {
  return (
    <Layout
      title="ScanDog - Attack Surface Detector"
      description="Attack surface report — discover endpoints, shadow APIs, and service boundaries"
    >
      <ScanDog />
    </Layout>
  );
}
