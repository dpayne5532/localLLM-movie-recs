const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { searchMovies, formatMoviesForPrompt } = require('../lib/movieSearch');

const INBOUND_PREFIX = 'inbound/';
const PROCESSED_PREFIX = 'inbound/processed/';
const OUTBOUND_PREFIX = 'outbound/';

app.timer('processMoviePreferences', {
    schedule: '0 */5 * * * *',  // Every 5 minutes
    handler: async (myTimer, context) => {
        context.log('Movie preference processor started at:', new Date().toISOString());

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'movies';
        const llmEndpoint = process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:8080/recommend';

        if (!connectionString) {
            context.error('AZURE_STORAGE_CONNECTION_STRING environment variable is not set');
            return;
        }

        let blobServiceClient;
        let containerClient;

        try {
            blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            containerClient = blobServiceClient.getContainerClient(containerName);

            const exists = await containerClient.exists();
            if (!exists) {
                context.log(`Container '${containerName}' does not exist. Creating...`);
                await containerClient.create();
            }
        } catch (error) {
            context.error('Failed to connect to Azure Blob Storage:', error.message);
            return;
        }

        const inboundFiles = [];

        try {
            for await (const blob of containerClient.listBlobsFlat({ prefix: INBOUND_PREFIX })) {
                if (blob.name.startsWith(PROCESSED_PREFIX)) {
                    continue;
                }
                if (blob.name === INBOUND_PREFIX) {
                    continue;
                }
                if (!blob.name.endsWith('.txt')) {
                    context.log(`Skipping non-txt file: ${blob.name}`);
                    continue;
                }
                inboundFiles.push(blob.name);
            }
        } catch (error) {
            context.error('Failed to list blobs in inbound folder:', error.message);
            return;
        }

        if (inboundFiles.length === 0) {
            context.log('No new files to process in inbound folder');
            return;
        }

        context.log(`Found ${inboundFiles.length} file(s) to process`);

        for (const blobName of inboundFiles) {
            await processFile(containerClient, blobName, llmEndpoint, context);
        }

        context.log('Movie preference processor completed at:', new Date().toISOString());
    }
});

async function processFile(containerClient, blobName, llmEndpoint, context) {
    const fileName = blobName.replace(INBOUND_PREFIX, '');
    context.log(`Processing file: ${fileName}`);

    let preferences;

    try {
        const blobClient = containerClient.getBlobClient(blobName);
        const downloadResponse = await blobClient.download(0);
        preferences = await streamToString(downloadResponse.readableStreamBody);
        context.log(`Successfully read preferences from: ${fileName}`);
    } catch (error) {
        context.error(`Failed to read file ${fileName}:`, error.message);
        return;
    }

    let recommendations;
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';

    // RAG: Search for relevant movies from our database
    let relevantMovies = [];
    try {
        context.log('Searching movie database for relevant films...');
        relevantMovies = searchMovies(preferences, 15);
        context.log(`Found ${relevantMovies.length} relevant movies from database`);
    } catch (error) {
        context.log('Movie search failed, continuing without RAG:', error.message);
    }

    try {
        context.log(`Sending preferences to LLM endpoint: ${llmEndpoint}`);
        context.log(`Using model: ${ollamaModel}`);

        const movieContext = relevantMovies.length > 0
            ? `\n\nHere are some movies from our database that match the user's preferences:\n\n${formatMoviesForPrompt(relevantMovies)}`
            : '';

        const prompt = `You are a movie recommendation expert with access to a movie database. Based on the user's preferences and the matching movies from our database, recommend 5 films they would enjoy.

IMPORTANT: Prioritize recommending movies from the provided database list below, as these are verified to exist. You may also suggest other well-known films if they're a great match.

User preferences:
${preferences}${movieContext}

Based on these preferences and available movies, provide 5 personalized recommendations. For each movie, explain why it matches their tastes:`;

        const response = await fetch(llmEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: ollamaModel,
                prompt: prompt,
                stream: false
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        recommendations = result.response;
        context.log(`Received recommendations for: ${fileName}`);
    } catch (error) {
        context.error(`Failed to get recommendations for ${fileName}:`, error.message);
        return;
    }

    const outboundFileName = generateOutboundFileName(fileName);
    const outboundBlobName = `${OUTBOUND_PREFIX}${outboundFileName}`;

    try {
        const outboundBlobClient = containerClient.getBlockBlobClient(outboundBlobName);

        await outboundBlobClient.upload(recommendations, recommendations.length, {
            blobHTTPHeaders: {
                blobContentType: 'text/plain',
            },
        });
        context.log(`Written recommendations to: ${outboundBlobName}`);
    } catch (error) {
        context.error(`Failed to write outbound file for ${fileName}:`, error.message);
        return;
    }

    try {
        const sourceBlobClient = containerClient.getBlobClient(blobName);
        const processedBlobName = `${PROCESSED_PREFIX}${fileName}`;
        const destinationBlobClient = containerClient.getBlockBlobClient(processedBlobName);

        const copyPoller = await destinationBlobClient.beginCopyFromURL(sourceBlobClient.url);
        await copyPoller.pollUntilDone();
        await sourceBlobClient.delete();

        context.log(`Moved processed file to: ${processedBlobName}`);
    } catch (error) {
        context.error(`Failed to move processed file ${fileName}:`, error.message);
    }
}

function generateOutboundFileName(inboundFileName) {
    const baseName = inboundFileName.replace(/\.txt$/i, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}_recommendations_${timestamp}.txt`;
}

// HTTP trigger for manual testing
app.http('triggerProcessing', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Manual trigger received');

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'movies';
        const llmEndpoint = process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:8080/recommend';

        if (!connectionString) {
            return { status: 500, body: 'AZURE_STORAGE_CONNECTION_STRING not set' };
        }

        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(containerName);

            const inboundFiles = [];
            for await (const blob of containerClient.listBlobsFlat({ prefix: 'inbound/' })) {
                if (blob.name.startsWith('inbound/processed/')) continue;
                if (blob.name === 'inbound/') continue;
                if (!blob.name.endsWith('.txt')) continue;
                inboundFiles.push(blob.name);
            }

            if (inboundFiles.length === 0) {
                return { status: 200, body: 'No files to process' };
            }

            const results = [];
            for (const blobName of inboundFiles) {
                try {
                    await processFile(containerClient, blobName, llmEndpoint, context);
                    results.push({ file: blobName, status: 'processed' });
                } catch (err) {
                    results.push({ file: blobName, status: 'error', error: err.message });
                }
            }

            return {
                status: 200,
                jsonBody: { processed: results.length, results }
            };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data.toString());
        });
        readableStream.on('end', () => {
            resolve(chunks.join(''));
        });
        readableStream.on('error', reject);
    });
}
