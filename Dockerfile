FROM rust:1.94.1 AS builder

RUN apt-get update && apt-get install -y \
    build-essential cmake pkg-config libssl-dev clang \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN cargo build -p zk-prover-server --release

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/zk-prover-server /usr/local/bin/

EXPOSE 8080

ENV RISC0_DEV_MODE=true
ENV RISC0_PROVER=local

CMD ["zk-prover-server"]
