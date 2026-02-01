#!/usr/bin/env node

/**
 * Utility script to upload a test preference file to Azure Blob Storage
 * Usage: node scripts/upload-test-file.js <path-to-json-file>
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

async function main() {
    const filePath = process.argv[2];

    if (!filePath) {
        console.log('Usage: node scripts/upload-test-file.js <path-to-json-file>');
        console.log('Example: node scripts/upload-test-file.js samples/sample-preferences.json');
        process.exit(1);
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'movies';

    if (!connectionString) {
        console.error('Error: AZURE_STORAGE_CONNECTION_STRING environment variable is not set');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    try {
        JSON.parse(content);
    } catch (e) {
        console.error(`Error: Invalid JSON in file: ${filePath}`);
        process.exit(1);
    }

    const fileName = path.basename(filePath);
    const blobName = `inbound/${fileName}`;

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        const exists = await containerClient.exists();
        if (!exists) {
            console.log(`Creating container: ${containerName}`);
            await containerClient.create();
        }

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.upload(content, content.length, {
            blobHTTPHeaders: {
                blobContentType: 'application/json',
            },
        });

        console.log(`Successfully uploaded: ${blobName}`);
        console.log(`Container: ${containerName}`);
    } catch (error) {
        console.error('Error uploading file:', error.message);
        process.exit(1);
    }
}

main();
