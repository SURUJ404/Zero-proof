FROM rust:1.94.1 AS builder

RUN apt-get update; apt-get install -y build-essential cmake pkg-config libssl-dev clang libclang-dev protobuf-compiler || true; rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

ENV RISC0_SKIP_BUILD_KERNELS=1
RUN cargo build -p zk-prover-server --release

FROM ubuntu:24.04

RUN apt-get update; apt-get install -y ca-certificates curl || true; rm -rf /var/lib/apt/lists/*; \
    groupadd -r zkprover && useradd -r -g zkprover -m -d /home/zkprover zkprover

COPY --from=builder /app/target/release/zk-prover-server /usr/local/bin/

EXPOSE 8080

ENV RISC0_DEV_MODE=true
ENV RISC0_PROVER=local
ENV PORT=8080

USER zkprover
WORKDIR /home/zkprover

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["zk-prover-server"]
