#!/usr/bin/env node

/**
 * Mock LLM Server for testing the Azure Function locally
 * Simulates the /recommend endpoint on the Mac Mini
 * Accepts plain text input, returns plain text recommendations
 *
 * Usage: node scripts/mock-llm-server.js [port]
 * Default port: 8080
 */

const http = require('http');

const PORT = parseInt(process.argv[2]) || 8080;

const MOCK_MOVIES = [
    'The Dark Knight (2008) - A gripping crime thriller with incredible performances',
    'Pulp Fiction (1994) - Tarantino\'s masterpiece of interweaving stories',
    'The Matrix (1999) - Mind-bending sci-fi action that redefined the genre',
    'Forrest Gump (1994) - A heartwarming journey through American history',
    'Goodfellas (1990) - The definitive gangster movie experience',
    'The Departed (2006) - Intense cat-and-mouse thriller set in Boston',
    'Blade Runner 2049 (2017) - Stunning visuals and philosophical depth',
    'Arrival (2016) - Thoughtful sci-fi about language and time',
    'No Country for Old Men (2007) - Tense and unforgettable Coen Brothers film',
    'The Prestige (2006) - Nolan\'s twisty tale of rival magicians',
];

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    if (req.method === 'POST' && req.url === '/recommend') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log('Received preferences:\n---');
            console.log(body);
            console.log('---\n');

            // Shuffle and pick random movies
            const shuffled = [...MOCK_MOVIES].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 5);

            const response = `Based on your preferences, here are my movie recommendations:

1. ${selected[0]}

2. ${selected[1]}

3. ${selected[2]}

4. ${selected[3]}

5. ${selected[4]}

I hope you enjoy these films! Let me know if you'd like more recommendations.`;

            console.log('Sending response:\n---');
            console.log(response);
            console.log('---\n');

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(response);
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Mock LLM Server running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log(`  POST /recommend - Get movie recommendations (plain text)`);
    console.log(`  GET  /health    - Health check`);
    console.log('\nPress Ctrl+C to stop\n');
});
