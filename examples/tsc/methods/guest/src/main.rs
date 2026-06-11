#![no_main]
#![no_std]

use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

const MEM_SIZE: usize = 65536;

struct Vm {
    regs: [u32; 32],
    pc: u32,
    mem: [u8; MEM_SIZE],
}

impl Vm {
    fn new(code: &[u8], entry: u32) -> Self {
        let mut mem = [0u8; MEM_SIZE];
        let len = code.len().min(MEM_SIZE - 4);
        mem[..len].copy_from_slice(&code[..len]);
        Vm { regs: [0; 32], pc: entry, mem }
    }

    fn r(&self, i: usize) -> u32 {
        if i == 0 { 0 } else { self.regs[i] }
    }

    fn w(&mut self, i: usize, v: u32) {
        if i != 0 { self.regs[i] = v; }
    }

    fn fetch(&self) -> u32 {
        let a = self.pc as usize;
        if a + 4 > MEM_SIZE { return 0; }
        u32::from_le_bytes([self.mem[a], self.mem[a + 1], self.mem[a + 2], self.mem[a + 3]])
    }

    fn sext(v: u32, bit: u32) -> u32 {
        (((v >> bit) & 1) as i32).wrapping_mul(-(1 << bit)) as u32 | v
    }

    fn step(&mut self) -> Option<i32> {
        let raw = self.fetch();
        if raw == 0 { return Some(self.r(10) as i32); }

        let opcode = raw & 0x7f;
        let rd = ((raw >> 7) & 0x1f) as usize;
        let funct3 = ((raw >> 12) & 0x7) as u8;
        let rs1 = ((raw >> 15) & 0x1f) as usize;
        let rs2 = ((raw >> 20) & 0x1f) as usize;
        let funct7 = (raw >> 25) as u8;

        match opcode {
            0x37 => { // LUI
                self.w(rd, raw & 0xfffff000);
                self.pc = self.pc.wrapping_add(4);
            }
            0x17 => { // AUIPC
                self.w(rd, self.pc.wrapping_add(raw & 0xfffff000));
                self.pc = self.pc.wrapping_add(4);
            }
            0x6f => { // JAL
                let imm = (Self::bit(raw, 31) as i32).wrapping_mul(0x100000)
                    | ((Self::bits(raw, 12, 19) << 1) as i32)
                    | ((Self::bit(raw, 20) as i32) << 11)
                    | ((Self::bits(raw, 21, 30) as i32));
                self.w(rd, self.pc.wrapping_add(4));
                self.pc = (self.pc as i32).wrapping_add(imm) as u32;
            }
            0x67 => { // JALR
                let imm = (raw as i32) >> 20;
                let target = (self.r(rs1) as i32).wrapping_add(imm) as u32 & !1;
                self.w(rd, self.pc.wrapping_add(4));
                self.pc = target;
            }
            0x63 => { // B-type branch
                let imm = (Self::bit(raw, 31) as i32).wrapping_mul(0x800)
                    | ((Self::bit(raw, 7) as i32) << 6)
                    | ((Self::bits(raw, 8, 11) as i32) << 1)
                    | ((Self::bits(raw, 25, 30) as i32) << 5);
                let taken = match funct3 {
                    0 => self.r(rs1) == self.r(rs2),       // BEQ
                    1 => self.r(rs1) != self.r(rs2),       // BNE
                    4 => (self.r(rs1) as i32) < (self.r(rs2) as i32), // BLT
                    5 => (self.r(rs1) as i32) >= (self.r(rs2) as i32), // BGE
                    6 => self.r(rs1) < self.r(rs2),        // BLTU
                    7 => self.r(rs1) >= self.r(rs2),       // BGEU
                    _ => false,
                };
                self.pc = if taken {
                    (self.pc as i32).wrapping_add(imm) as u32
                } else {
                    self.pc.wrapping_add(4)
                };
            }
            0x03 => { // Load
                let imm = (raw as i32) >> 20;
                let addr = (self.r(rs1) as i32).wrapping_add(imm) as usize;
                let val = match funct3 {
                    0 => Self::sext(self.mem[addr] as u32, 7),
                    1 => Self::sext(u16::from_le_bytes([self.mem[addr], self.mem[addr + 1]]) as u32, 15),
                    2 => u32::from_le_bytes([self.mem[addr], self.mem[addr + 1], self.mem[addr + 2], self.mem[addr + 3]]),
                    4 => self.mem[addr] as u32,
                    5 => u16::from_le_bytes([self.mem[addr], self.mem[addr + 1]]) as u32,
                    _ => 0,
                };
                self.w(rd, val);
                self.pc = self.pc.wrapping_add(4);
            }
            0x23 => { // Store
                let imm = ((raw as i32) >> 25 << 5) | (Self::bits(raw, 7, 11) as i32);
                let addr = (self.r(rs1) as i32).wrapping_add(imm) as usize;
                let val = self.r(rs2);
                match funct3 {
                    0 => self.mem[addr] = val as u8,
                    1 => { let b = val.to_le_bytes(); self.mem[addr] = b[0]; self.mem[addr + 1] = b[1]; }
                    2 => { let b = val.to_le_bytes(); self.mem[addr..addr + 4].copy_from_slice(&b); }
                    _ => {}
                }
                self.pc = self.pc.wrapping_add(4);
            }
            0x13 => { // ALU immediate
                let imm = (raw as i32) >> 20;
                let rs1v = self.r(rs1);
                let val = match funct3 {
                    0 => (rs1v as i32).wrapping_add(imm) as u32,  // ADDI
                    1 => rs1v.wrapping_shl(imm as u32 & 0x1f),    // SLLI
                    2 => (rs1v < imm as u32) as u32,              // SLTIU (imm sign-extended)
                    3 => ((rs1v as i32) < imm) as u32,            // SLTI
                    4 => rs1v ^ imm as u32,                        // XORI
                    5 => {
                        let sh = imm as u32 & 0x1f;
                        if funct7 & 0x20 != 0 { (rs1v as i32).wrapping_shr(sh) as u32 } // SRAI
                        else { rs1v.wrapping_shr(sh) }                                   // SRLI
                    }
                    6 => rs1v | imm as u32,                        // ORI
                    7 => rs1v & imm as u32,                        // ANDI
                    _ => 0,
                };
                self.w(rd, val);
                self.pc = self.pc.wrapping_add(4);
            }
            0x33 => { // R-type ALU
                let rs1v = self.r(rs1);
                let rs2v = self.r(rs2);
                let val = match (funct3, funct7) {
                    (0, 0x00) => rs1v.wrapping_add(rs2v),                         // ADD
                    (0, 0x20) => (rs1v as i32).wrapping_sub(rs2v as i32) as u32, // SUB
                    (1, 0x00) => rs1v.wrapping_shl(rs2v & 0x1f),                  // SLL
                    (2, 0x00) => (rs1v < rs2v) as u32,                            // SLTU
                    (3, 0x00) => ((rs1v as i32) < (rs2v as i32)) as u32,          // SLT
                    (4, 0x00) => rs1v ^ rs2v,                                      // XOR
                    (5, 0x00) => rs1v.wrapping_shr(rs2v & 0x1f),                   // SRL
                    (5, 0x20) => (rs1v as i32).wrapping_shr(rs2v & 0x1f) as u32,  // SRA
                    (6, 0x00) => rs1v | rs2v,                                       // OR
                    (7, 0x00) => rs1v & rs2v,                                       // AND
                    _ => 0,
                };
                self.w(rd, val);
                self.pc = self.pc.wrapping_add(4);
            }
            0x0f => { // FENCE — nop
                self.pc = self.pc.wrapping_add(4);
            }
            0x73 => { // SYSTEM
                let funct12 = raw >> 20;
                match funct12 {
                    0x000 => return Some(self.r(10) as i32), // ECALL — halt, return a0
                    0x001 => return Some(self.r(10) as i32), // EBREAK — halt
                    0x105 => { self.pc = self.pc.wrapping_add(4); } // WFI — nop
                    _ => { self.pc = self.pc.wrapping_add(4); }
                }
            }
            _ => return Some(self.r(10) as i32), // unsupported opcode = halt
        }
        None
    }

    fn run(&mut self) -> i32 {
        loop {
            if let Some(ret) = self.step() { return ret; }
        }
    }

    fn bit(x: u32, n: u32) -> u32 { (x >> n) & 1 }
    fn bits(x: u32, lo: u32, hi: u32) -> u32 {
        let mask = (1u32 << (hi - lo + 1)) - 1;
        (x >> lo) & mask
    }
}

fn main() {
    let code: Vec<u8> = env::read();
    let entry: u32 = env::read();
    let mut vm = Vm::new(&code, entry);
    let result = vm.run();
    env::commit(&result);
}
