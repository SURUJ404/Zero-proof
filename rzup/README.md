# rzup

`rzup` is a tool for managing Zero Proof toolchain components. It helps you install, update, and switch between different versions of Zero Proof tools.

## Installation

`rzup` can be installed with:

```sh
curl -L https://github.com/suruj404/zero-knowledgerisc/install | bash
```

## Commands

### Install

Install Zero Proof components.

```sh
rzup install [OPTIONS] [NAME] [VERSION]
```

Arguments:

- `NAME`: (Optional) component name to install (e.g., "rust", "cargo-risczero")
- `VERSION`: (Optional) Version to install. If no version is specified, it will use the latest release version.

Options:

- `-f, --force`: Force reinstallation even if already installed

Examples:

```sh
# Install latest versions of all components
rzup install

# Install specific version of cargo-risczero
rzup install cargo-risczero 1.0.0

# Force reinstall latest rust toolchain
rzup install rust --force
```

### Update

Update your Zero Proof installation.

```sh
# Update to latest versions of all components
rzup update
```

_Note:_ `update` is an alias to `install`.

### Check

Check for available updates of installed components.

```sh
rzup check
```

### Use

Switch to a specific version of a component.

```sh
rzup use <NAME> <VERSION>
```

Arguments:

- `NAME`: Component name (required)
- `VERSION`: Version to activate (required)

### Show

Display information about installed components and versions.

Example output:

```sh
Installed components:
--------------------

cargo-risczero
* 1.1.0
  1.0.0

rust
* 1.79.0
  1.81.0
```

The `*` indicates the current default version.

### Uninstall

Remove a specific version of a component.

```sh
rzup uninstall <NAME> <VERSION>
```

Arguments:

- `NAME`: Component name (required)
- `VERSION`: Version to uninstall (required)

### Build

Build a particular component from source.

```sh
rzup build <NAME> <COMMIT-OR-TAG>
```

Right now this command only supports building the Rust toolchain.

Downloads the source code for the given component from GitHub, builds it, installs it, and makes it
the default version.

The resulting version of the component will contain the commit hash.

## Components

rzup manages the following components:

1. **rust**: The Zero Proof Rust toolchain
   - Rust compiler and tools optimized for the Zero Proof zkVM

2. **cpp**: The Zero Proof C++ toolchain
   - The C++ compiler and tools optimized for the Zero Proof zkVM

3. **cargo-risczero**: The Zero Proof Cargo extension
   - Provides cargo subcommands for Zero Proof development

4. **r0vm**: The Zero Proof zkVM
    - Precompiled version of the Zero Proof zkVM

## Configuration

rzup stores its installations in:

- Default: Linux/macOS: `$HOME/.risc0/`
- Custom: Set with the `RISC0_HOME` environment variable

When communicating with GitHub, it tries using authentication. This can be useful to get around
rate-limiting. It attempts to get a token from the `GITHUB_TOKEN` environment variable, then from
~/.config/gh/hosts.yml.

### publish

rzup currently downloads components from both GitHub and S3. We are in the process of transitioning
where components live from GitHub to S3. The publish command is for uploading new components to S3.

It stores the components in s3://risc0-artifacts/rzup/components/<component-name>/

#### create-artifact

To publish an artifact as a component, first an artifact must be created. A valid artifact is just a
.tar.xz file.

To create an artifact, `publish create-artifact` can be used like
```bash
rzup publish create-artifact --input <directory-path> --output <output>.tar.xz
```

This command creates a .tar.xz file but uses parallel compression and displays a progress bar. This
command doesn't have to be used, but is provided for convenience.

#### upload

To upload an artifact to S3 as a component, `publish upload` can be used like
```bash
rzup publish upload (--target-agnostic|--target <target-triple>) <component-name> <version> <artifact>.tar.xz
```

This command must be run in an environment with AWS credentials available. It will publish the
artifact as a component with the given name and version.

If `--target-agnostic` flag is given, the artifact will be used for all targets, otherwise `--target
<target-triple>` must be used to mark which target the artifact should be used for (e.g.
aarch64-apple-darwin, or x86_64-unknown-linux-gnu)

Uploads are signed with a private key that is stored in AWS secrets manager, the key is obtained at
publish time using aforementioned AWS credentials.

#### set-latest
The published component metadata includes information about what component version is the latest
version. (This is the version that rzup will download by default.) To update what this version is,
the `set-latest` command can be used.

```bash
rzup publish set-latest <component> 1.2.3
```
