use tsc_methods::TSC_GUEST_ELF;
use risc0_zkvm::{ExecutorEnv, Receipt, default_prover};

pub fn run_vm(code: Vec<u8>, entry: u32) -> (Receipt, i32) {
    let env = ExecutorEnv::builder()
        .write(&code).unwrap()
        .write(&entry).unwrap()
        .build().unwrap();

    let prover = default_prover();
    let receipt = prover.prove(env, TSC_GUEST_ELF).unwrap().receipt;
    let result: i32 = receipt.journal.decode().unwrap();
    (receipt, result)
}

/// Build a simple test RISC-V program that returns a0 = 43
pub fn make_test_program() -> Vec<u8> {
    // addi x10, x0, 42   → 0x02a00513
    // addi x10, x10, 1   → 0x00150513
    // ebreak             → 0x00100073
    let code: &[u32] = &[0x02a00513, 0x00150513, 0x00100073];
    code.iter().flat_map(|w| w.to_le_bytes()).collect()
}

/// Build a sum-1-to-10 program that returns a0 = 55
pub fn make_sum_program() -> Vec<u8> {
    // a0 = 0, a1 = 1, a2 = 10
    // loop: a0 += a1, a1++, if a1 < 10 goto loop
    // ebreak
    let code: &[u32] = &[
        0x00000513, // addi x10, x0, 0
        0x00100593, // addi x11, x0, 1
        0x00a00613, // addi x12, x0, 10
        0x00b50533, // add  x10, x10, x11
        0x00158593, // addi x11, x11, 1
        0xfecb4ee3, // blt  x11, x12, loop (offset = -12)
        0x00100073, // ebreak
    ];
    code.iter().flat_map(|w| w.to_le_bytes()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_addi() {
        let code = make_test_program();
        let (_, result) = run_vm(code, 0);
        assert_eq!(result, 43);
    }

    #[test]
    fn test_sum_1_to_10() {
        let code = make_sum_program();
        let (_, result) = run_vm(code, 0);
        assert_eq!(result, 55);
    }
}
