FROM rust:1.85 AS builder
WORKDIR /app
COPY . .
RUN cargo build -p zp-prover-service --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/zp-prover-service /usr/local/bin/
EXPOSE 8082
CMD ["zp-prover-service"]
