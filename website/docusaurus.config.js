// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion!

import { themes as prismThemes } from "prism-react-renderer";
import katex from "rehype-katex";
import math from "remark-math";
import apiVersions from "./api_versions.json";
import rustCode from "./src/remark/rust.js";

const baseUrl = process.env.BASE_URL ?? "/";

export default async function createConfigAsync() {
  /** @type {import('@docusaurus/types').Config} */
  return {
    title: "Zero Proof Developer Docs",
    tagline: "Hyper-Efficient General Purpose Zero-Knowledge Computing.",
    favicon: "img/favicon.ico",

    url: "https://zero-proof-pearl.vercel.app",
    baseUrl: baseUrl,

    organizationName: "zero-proof",
    projectName: "devdocs",

    onBrokenLinks: "warn",
    onBrokenMarkdownLinks: "warn",

    i18n: {
      defaultLocale: "en",
      locales: ["en"],
    },

    presets: [
      [
        "classic",
        /** @type {import('@docusaurus/preset-classic').Options} */
        ({
          docs: {
            routeBasePath: "/",
            sidebarPath: require.resolve("./sidebars.js"),
            remarkPlugins: [math, rustCode],
            rehypePlugins: [katex],
          },
          blog: false,
          pages: {},
          theme: {
            customCss: require.resolve("./src/css/custom.css"),
          },
        }),
      ],
    ],

    plugins: [
      [
        "@docusaurus/plugin-content-docs",
        {
          id: "api",
          path: "api",
          routeBasePath: "api",
          sidebarPath: "./sidebarsApi.js",
          remarkPlugins: [math, rustCode],
          rehypePlugins: [katex],
          editUrl: ({ locale, docPath }) => {
            // We want users to submit updates to the upstream/next version!
            // Otherwise we risk losing the update on the next release.
            return `https://github.com/SURUJ404/Zero-proof/edit/main/website/api/${docPath}`;
          },
        },
      ],
      [
        "@docusaurus/plugin-client-redirects",
        {
          createRedirects(existingPath) {
            if (
              existingPath.includes("/api/generating-proofs/remote-proving")
            ) {
              return [
                existingPath.replace(
                  "/api/generating-proofs/remote-proving",
                  "/bonsai",
                ),
                existingPath.replace(
                  "/api/generating-proofs/remote-proving",
                  "/bonsai/quickstart",
                ),
              ];
            }
            if (existingPath.includes("/zkvm/precompiles")) {
              return [
                existingPath.replace("/zkvm/precompiles", "/zkvm/acceleration"),
              ];
            }
            if (existingPath.includes("/zkvm/developer-guide/precompiles")) {
              return [
                existingPath.replace(
                  "/zkvm/developer-guide/precompiles",
                  "/zkvm/developer-guide/acceleration",
                ),
              ];
            }

            if (existingPath.includes("/api/zkvm")) {
              return [existingPath.replace("/api/zkvm", "/zkvm")];
            }

            if (existingPath.includes("/api")) {
              return [existingPath.replace("/api", `/api/${apiVersions[0]}`)];
            }

            return undefined;
          },
          redirects: [{ from: "/tech_faq", to: "/faq" }],
        },
      ],
    ],

    stylesheets: [
      {
        href: "https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css",
        type: "text/css",
        integrity:
          "sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM",
        crossorigin: "anonymous",
      },
    ],

    themeConfig:
      /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
      ({
        metadata: [
          { name: "twitter:card", content: "summary_large_image" },
          { name: "og:type", content: "website" },
          { name: "og:logo", content: "img/logo.svg" },
        ],
        navbar: {
          logo: {
            alt: "Zero Proof",
            src: "img/logo.svg",
            href: "/",
          },
          items: [
            {
              position: "left",
              label: "Documentation",
              to: "/api",
            },
            {
              position: "left",
              label: "Terminology",
              to: "/terminology",
            },
            {
              position: "left",
              label: "FAQ",
              to: "/faq",
            },
            {
              position: "left",
              label: "Education Hub",
              to: "/education",
            },
            {
              type: "docsVersionDropdown",
              position: "right",
              docsPluginId: "api",
              className: "docsVersionDropdown",
            },
            {
              href: "https://www.github.com/SURUJ404/Zero-proof/blog",
              position: "right",
              label: "Blog",
            },
            {
              href: "https://github.com/SURUJ404/Zero-proof",
              position: "right",
              label: "GitHub",
            },
            {
              type: "dropdown",
              position: "right",
              label: "Community",
              items: [
                {
                  label: "Twitter",
                  href: "https://x.com/ZeroProof",
                },
                {
                  label: "YouTube",
                  href: "https://www.youtube.com",
                },
                {
                  label: "Stack Overflow",
                  href: "https://stackoverflow.com/questions/tagged/zero-proof",
                },
                {
                  label: "Contributor's Guide",
                  to: "contributors-guide",
                },
              ],
            },
          ],
        },
        footer: {
          logo: {
            alt: "Zero Proof",
            src: "img/logo.svg",
            href: "https://github.com/SURUJ404/Zero-proof",
            height: 42,
          },
          links: [
            {
              items: [
                {
                  label: "Blog",
                  href: "https://www.github.com/SURUJ404/Zero-proof/blog",
                },
                {
                  label: "Careers",
                  href: "https://jobs.ashbyhq.com/ZeroProof",
                },
                {
                  label: "Bug Bounties",
                  href: "https://hackenproof.com/company/zero-proof/programs",
                },
              ],
            },
            {
              items: [
                {
                  label: "GitHub",
                  href: "https://github.com/SURUJ404/Zero-proof",
                },
                {
                  label: "X",
                  href: "https://x.com/ZeroProof",
                },
                {
                  label: "YouTube",
                  href: "https://www.youtube.com",
                },
              ],
            },
          ],
          copyright: `©${new Date().getFullYear()} Zero Proof`,
        },
        prism: {
          additionalLanguages: ["bash", "rust", "toml"],
          theme: prismThemes.github,
          darkTheme: prismThemes.dracula,
        },
        colorMode: {
          defaultMode: "dark",
          respectPrefersColorScheme: false,
        },
        algolia: {
          appId: "ZCZDPHYHKH",
          apiKey: "9fe8b9b5a0f08f1df1fc4dc90086ee43", // Public API key
          indexName: "docs",
          searchPagePath: "search",

          // Leaving at the default of `true` for now
          contextualSearch: true,
        },
      }),
  };
}
