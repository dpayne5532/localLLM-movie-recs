/**
 * Movie search module for RAG-based recommendations
 * Searches the local movie index to find relevant films
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', '..', 'data', 'movie-index.json');

let movieIndex = null;

function loadIndex() {
    if (movieIndex) return movieIndex;

    if (!fs.existsSync(INDEX_PATH)) {
        throw new Error(`Movie index not found at ${INDEX_PATH}. Run: node scripts/build-movie-index.js`);
    }

    const data = fs.readFileSync(INDEX_PATH, 'utf-8');
    movieIndex = JSON.parse(data);
    console.log(`Loaded movie index: ${movieIndex.count} movies`);
    return movieIndex;
}

/**
 * Extract keywords from user preferences text
 */
function extractKeywords(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\W+/).filter(w => w.length > 2);

    // Common words to ignore
    const stopwords = new Set([
        'the', 'and', 'but', 'for', 'with', 'this', 'that', 'have', 'from',
        'like', 'love', 'enjoy', 'want', 'would', 'really', 'very', 'much',
        'some', 'any', 'also', 'just', 'more', 'most', 'other', 'such',
        'movies', 'movie', 'films', 'film', 'watch', 'watching', 'seen',
        'recommend', 'recommendations', 'please', 'looking', 'something'
    ]);

    return words.filter(w => !stopwords.has(w));
}

/**
 * Extract specific entities (actors, genres, decades)
 */
function extractEntities(text) {
    const lower = text.toLowerCase();

    const entities = {
        genres: [],
        decades: [],
        actors: [],
        directors: []
    };

    // Genre detection
    const genrePatterns = [
        'action', 'adventure', 'animation', 'comedy', 'crime', 'documentary',
        'drama', 'family', 'fantasy', 'history', 'horror', 'music', 'mystery',
        'romance', 'science fiction', 'sci-fi', 'thriller', 'war', 'western'
    ];

    for (const genre of genrePatterns) {
        if (lower.includes(genre)) {
            entities.genres.push(genre === 'sci-fi' ? 'science fiction' : genre);
        }
    }

    // Decade detection
    const decadeMatch = lower.match(/(\d{4})s?|(\d{2})s\b/g);
    if (decadeMatch) {
        for (const match of decadeMatch) {
            const num = parseInt(match);
            if (num >= 1900 && num <= 2030) {
                entities.decades.push(Math.floor(num / 10) * 10);
            } else if (num >= 20 && num <= 99) {
                entities.decades.push(1900 + num);
            }
        }
    }

    return entities;
}

/**
 * Score a movie based on search criteria
 */
function scoreMovie(movie, keywords, entities) {
    let score = 0;

    // Base score from rating and popularity
    score += movie.rating * 2;
    score += Math.min(Math.log(movie.votes + 1) * 2, 20);

    // Keyword matches in search text
    for (const keyword of keywords) {
        if (movie.searchText.includes(keyword)) {
            score += 15;
            // Bonus for title match
            if (movie.title.toLowerCase().includes(keyword)) {
                score += 25;
            }
            // Bonus for actor match
            if (movie.cast.some(c => c.toLowerCase().includes(keyword))) {
                score += 30;
            }
            // Bonus for director match
            if (movie.director.toLowerCase().includes(keyword)) {
                score += 25;
            }
        }
    }

    // Genre matches
    for (const genre of entities.genres) {
        if (movie.genres.includes(genre)) {
            score += 40;
        }
    }

    // Decade matches
    for (const decade of entities.decades) {
        if (movie.year >= decade && movie.year < decade + 10) {
            score += 30;
        }
    }

    return score;
}

/**
 * Search for movies matching user preferences
 */
function searchMovies(userPreferences, limit = 20) {
    const index = loadIndex();

    const keywords = extractKeywords(userPreferences);
    const entities = extractEntities(userPreferences);

    console.log('Search keywords:', keywords.slice(0, 10));
    console.log('Detected entities:', entities);

    // Score all movies
    const scored = index.movies.map(movie => ({
        movie,
        score: scoreMovie(movie, keywords, entities)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top results
    return scored.slice(0, limit).map(s => s.movie);
}

/**
 * Format movies for inclusion in LLM prompt
 */
function formatMoviesForPrompt(movies) {
    return movies.map((m, i) => {
        const cast = m.cast.slice(0, 3).join(', ');
        return `${i + 1}. "${m.title}" (${m.year}) - ${m.genres.join('/')} - Rating: ${m.rating}/10
   Cast: ${cast}${m.director ? ` | Director: ${m.director}` : ''}
   ${m.overview.substring(0, 150)}...`;
    }).join('\n\n');
}

module.exports = {
    loadIndex,
    searchMovies,
    formatMoviesForPrompt,
    extractKeywords,
    extractEntities
};
