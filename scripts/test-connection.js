#!/usr/bin/env node

const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

// Load connection string from local.settings.json
const settingsPath = path.join(__dirname, '..', 'local.settings.json');
if (!fs.existsSync(settingsPath)) {
    console.error('Error: local.settings.json not found. Copy from local.settings.json.example and configure.');
    process.exit(1);
}
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
const connectionString = settings.Values.AZURE_STORAGE_CONNECTION_STRING;
const containerName = settings.Values.AZURE_STORAGE_CONTAINER_NAME || "movierecs";

async function main() {
    console.log("Testing Azure Storage connection...\n");

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        console.log(`✓ Connected to storage account`);
        console.log(`✓ Container: ${containerName}\n`);

        // List blobs
        console.log("Listing blobs in container:");
        for await (const blob of containerClient.listBlobsFlat()) {
            console.log(`  - ${blob.name}`);
        }

        // Upload a test file
        const testFileName = `inbound/test-${Date.now()}.txt`;
        const testContent = `I love movies with Tom Hanks and Leonardo DiCaprio.
My favorite genres are drama and thriller.
I really enjoyed Inception, The Shawshank Redemption, and Interstellar.
Please recommend some movies I might enjoy.`;

        console.log(`\nUploading test file: ${testFileName}`);
        const blockBlobClient = containerClient.getBlockBlobClient(testFileName);
        await blockBlobClient.upload(testContent, testContent.length, {
            blobHTTPHeaders: { blobContentType: 'text/plain' }
        });
        console.log("✓ Test file uploaded successfully!\n");

        // List inbound folder
        console.log("\nFiles in inbound/:");
        for await (const blob of containerClient.listBlobsFlat({ prefix: 'inbound/' })) {
            if (!blob.name.includes('/processed/') && blob.name.endsWith('.txt')) {
                console.log(`  - ${blob.name}`);
            }
        }

    } catch (error) {
        console.error("✗ Error:", error.message);
        process.exit(1);
    }
}

main();
