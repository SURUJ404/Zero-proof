FROM rust:1.85 AS builder
WORKDIR /app
COPY . .
RUN cargo build -p zp-gateway --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/zp-gateway /usr/local/bin/
EXPOSE 8080
CMD ["zp-gateway"]
