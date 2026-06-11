use tsc::make_sum_program;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let code = make_sum_program();
    let expected = 55;

    let (receipt, result) = tsc::run_vm(code, 0);
    receipt.verify(tsc_methods::TSC_GUEST_ID)
        .expect("Receipt verification failed");

    println!("Proved RISC-V program execution inside zkVM!");
    println!("Result: {result} (expected {expected})");
    assert_eq!(result, expected, "VM output should match expected");
}
