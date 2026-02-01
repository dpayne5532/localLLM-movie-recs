#!/usr/bin/env node

/**
 * Build a searchable movie index from TMDB data
 * Creates a JSON index that can be searched at runtime
 */

const fs = require('fs');
const path = require('path');

const MOVIE_DATA_DIR = '/Users/catalystsolutions/Developer/LocalLLM/movieRecs/movieData';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'movie-index.json');

function loadMovies() {
    const movies = [];
    const files = fs.readdirSync(MOVIE_DATA_DIR)
        .filter(f => f.startsWith('movie_details') && f.endsWith('.json'));

    console.log(`Found ${files.length} movie data files\n`);

    for (const file of files) {
        const filePath = path.join(MOVIE_DATA_DIR, file);
        process.stdout.write(`Loading ${file}... `);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
                const validMovies = data.filter(m =>
                    m.title &&
                    m.overview &&
                    m.overview.length > 20 &&
                    m.release_date &&
                    m.vote_average >= 5.0  // Only decent movies
                );
                movies.push(...validMovies);
                console.log(`${validMovies.length} movies`);
            }
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }

    return movies;
}

function processMovie(movie) {
    const cast = movie.credits?.cast?.slice(0, 10).map(c => c.name) || [];
    const director = movie.credits?.crew?.find(c => c.job === 'Director')?.name || '';
    const year = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null;

    return {
        id: movie.id,
        title: movie.title,
        year,
        genres: movie.genres?.map(g => g.name.toLowerCase()) || [],
        rating: Math.round(movie.vote_average * 10) / 10,
        votes: movie.vote_count,
        overview: movie.overview,
        cast,
        director,
        // Create searchable text
        searchText: [
            movie.title,
            ...cast,
            director,
            ...(movie.genres?.map(g => g.name) || []),
            movie.overview
        ].join(' ').toLowerCase()
    };
}

function main() {
    console.log('=== Building Movie Index ===\n');

    const rawMovies = loadMovies();
    console.log(`\nTotal movies loaded: ${rawMovies.length}`);

    // Process and dedupe
    const seen = new Set();
    const movies = [];

    for (const movie of rawMovies) {
        if (seen.has(movie.id)) continue;
        seen.add(movie.id);
        movies.push(processMovie(movie));
    }

    // Sort by rating * votes for quality
    movies.sort((a, b) => (b.rating * Math.log(b.votes + 1)) - (a.rating * Math.log(a.votes + 1)));

    console.log(`Unique movies: ${movies.length}`);

    // Create output directory
    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Save index
    const index = {
        version: 1,
        created: new Date().toISOString(),
        count: movies.length,
        movies
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index));
    const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`\n✓ Saved to ${OUTPUT_FILE} (${sizeMB} MB)`);

    // Stats
    const decades = {};
    const genres = {};
    for (const m of movies) {
        if (m.year) {
            const decade = Math.floor(m.year / 10) * 10;
            decades[decade] = (decades[decade] || 0) + 1;
        }
        for (const g of m.genres) {
            genres[g] = (genres[g] || 0) + 1;
        }
    }

    console.log('\nMovies by decade:');
    Object.entries(decades).sort((a, b) => a[0] - b[0]).forEach(([d, c]) => {
        console.log(`  ${d}s: ${c}`);
    });

    console.log('\nTop genres:');
    Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([g, c]) => {
        console.log(`  ${g}: ${c}`);
    });

    console.log('\n=== Done! ===');
}

main();
