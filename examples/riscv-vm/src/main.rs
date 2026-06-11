use riscv_vm::make_sum_program;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let code = make_sum_program();
    let expected = 55;

    let (receipt, result) = riscv_vm::run_vm(code, 0);
    receipt.verify(riscv_vm_methods::RISCV_VM_ID)
        .expect("Receipt verification failed");

    println!("Proved RISC-V program execution inside zkVM!");
    println!("Result: {result} (expected {expected})");
    assert_eq!(result, expected, "VM output should match expected");
}
