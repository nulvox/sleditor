#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <openssl/evp.h>
#include <openssl/aes.h>
#include <time.h>

// Brute force search every byte offset in a file as a potential AES key
// Tests both AES-128 (16-byte key) and AES-256 (32-byte key)

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <binary_file>\n", argv[0]);
        return 1;
    }

    // Known values from the save file analysis:
    // IV (first 16 bytes of ciphertext)
    unsigned char iv[] = {
        0x4b, 0xd6, 0xca, 0xa9, 0x5d, 0x21, 0x1b, 0x0a,
        0x13, 0x54, 0x78, 0x64, 0x24, 0xf1, 0xf7, 0x5c
    };

    // First ciphertext block (bytes 16-31)
    unsigned char ct_block[] = {
        0x4b, 0xc9, 0x07, 0x9d, 0x4f, 0xf9, 0x13, 0x1a,
        0x6f, 0x4c, 0x50, 0xcb, 0x11, 0x86, 0x3a, 0x8b
    };

    // First plaintext block: {"_pointsCurrent = 0x7b225f706f696e747343757272656e74
    unsigned char pt_block[] = {
        0x7b, 0x22, 0x5f, 0x70, 0x6f, 0x69, 0x6e, 0x74,
        0x73, 0x43, 0x75, 0x72, 0x72, 0x65, 0x6e, 0x74
    };

    // Expected: AES_ECB_DECRYPT(ct_block, key) = pt_block XOR iv
    unsigned char expected[16];
    for (int i = 0; i < 16; i++) {
        expected[i] = pt_block[i] ^ iv[i];
    }

    printf("Expected decrypted block: ");
    for (int i = 0; i < 16; i++) printf("%02x", expected[i]);
    printf("\n");

    // Read the binary file
    FILE *f = fopen(argv[1], "rb");
    if (!f) { perror("fopen"); return 1; }
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);
    unsigned char *data = malloc(fsize);
    if (!data) { perror("malloc"); return 1; }
    fread(data, 1, fsize, f);
    fclose(f);

    printf("File size: %ld bytes\n", fsize);
    printf("Searching for AES-128 keys...\n");

    time_t start = time(NULL);
    long checked = 0;
    unsigned char outbuf[32];
    int outlen;

    // Try AES-128 (16-byte keys)
    for (long i = 0; i <= fsize - 16; i++) {
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        EVP_DecryptInit_ex(ctx, EVP_aes_128_ecb(), NULL, data + i, NULL);
        EVP_CIPHER_CTX_set_padding(ctx, 0);
        EVP_DecryptUpdate(ctx, outbuf, &outlen, ct_block, 16);
        EVP_CIPHER_CTX_free(ctx);

        if (memcmp(outbuf, expected, 16) == 0) {
            printf("\n*** FOUND AES-128 KEY at offset %ld (0x%lx)! ***\n", i, i);
            printf("Key: ");
            for (int j = 0; j < 16; j++) printf("%02x", data[i+j]);
            printf("\n");
            free(data);
            return 0;
        }

        checked++;
        if (checked % 10000000 == 0) {
            time_t now = time(NULL);
            double elapsed = difftime(now, start);
            if (elapsed > 0) {
                double rate = checked / elapsed;
                double remaining = (fsize - 16 - checked) / rate;
                printf("  AES-128: %ld/%ld (%.1f%%), %.0f/s, ETA: %.0fs\n",
                       checked, fsize-16, 100.0*checked/(fsize-16), rate, remaining);
            }
        }
    }

    printf("\nAES-128 not found. Searching AES-256...\n");
    checked = 0;
    start = time(NULL);

    // Try AES-256 (32-byte keys)
    for (long i = 0; i <= fsize - 32; i++) {
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        EVP_DecryptInit_ex(ctx, EVP_aes_256_ecb(), NULL, data + i, NULL);
        EVP_CIPHER_CTX_set_padding(ctx, 0);
        EVP_DecryptUpdate(ctx, outbuf, &outlen, ct_block, 16);
        EVP_CIPHER_CTX_free(ctx);

        if (memcmp(outbuf, expected, 16) == 0) {
            printf("\n*** FOUND AES-256 KEY at offset %ld (0x%lx)! ***\n", i, i);
            printf("Key: ");
            for (int j = 0; j < 32; j++) printf("%02x", data[i+j]);
            printf("\n");
            free(data);
            return 0;
        }

        checked++;
        if (checked % 10000000 == 0) {
            time_t now = time(NULL);
            double elapsed = difftime(now, start);
            if (elapsed > 0) {
                double rate = checked / elapsed;
                double remaining = (fsize - 32 - checked) / rate;
                printf("  AES-256: %ld/%ld (%.1f%%), %.0f/s, ETA: %.0fs\n",
                       checked, fsize-32, 100.0*checked/(fsize-32), rate, remaining);
            }
        }
    }

    printf("\nKey NOT found in entire file.\n");
    free(data);
    return 1;
}
