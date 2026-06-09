#ifdef __cplusplus
extern "C" {
#endif

const char* risc0_circuit_rv32im_last_error() { return ""; }
void risc0_circuit_rv32im_clear_last_error() {}
void risc0_circuit_rv32im_segment_free(void* ctx) { (void)ctx; }
void risc0_circuit_rv32im_preflight_free(void* ctx) { (void)ctx; }
void risc0_circuit_rv32im_prover_free(void* ctx) { (void)ctx; }
void* risc0_circuit_rv32im_segment_new(const void* segment) { (void)segment; return 0; }
void* risc0_circuit_rv32im_segment_preflight(void* sctx, unsigned long po2) { (void)sctx; (void)po2; return 0; }
unsigned long risc0_circuit_rv32im_preflight_is_final(const void* ctx) { (void)ctx; return 0; }
const void* risc0_circuit_rv32im_preflight_row_info(const void* ctx) { (void)ctx; return 0; }
unsigned long risc0_circuit_rv32im_preflight_row_info_size(const void* ctx) { (void)ctx; return 0; }
const unsigned int* risc0_circuit_rv32im_preflight_aux(const void* ctx) { (void)ctx; return 0; }
unsigned long risc0_circuit_rv32im_preflight_aux_size(const void* ctx) { (void)ctx; return 0; }
const unsigned int* risc0_circuit_rv32im_preflight_block_counts(const void* ctx) { (void)ctx; return 0; }
void* risc0_circuit_rv32im_prover_new_cpu(unsigned long po2) { (void)po2; return 0; }
void risc0_circuit_rv32im_prove(const void* ctx, const void* rowInfo, unsigned long rowInfoSize, const unsigned int* aux, unsigned long auxSize) { (void)ctx; (void)rowInfo; (void)rowInfoSize; (void)aux; (void)auxSize; }
const void* risc0_circuit_rv32im_prover_transcript(const void* ctx) { (void)ctx; return 0; }

#ifdef __cplusplus
}
#endif
