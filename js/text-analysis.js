(function (global) {
    "use strict";

    // Standard English stop-words plus a few ATLA-specific fillers / stage-direction
    // words that show up because the source transcripts inline directions inside dialogue.
    const STOP_WORDS = new Set([
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
        "any", "are", "aren", "as", "at", "be", "because", "been", "before", "being",
        "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn",
        "did", "didn", "do", "does", "doesn", "doing", "don", "down", "during", "each",
        "few", "for", "from", "further", "had", "hadn", "has", "hasn", "have", "haven",
        "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
        "how", "i", "if", "in", "into", "is", "isn", "it", "its", "itself", "just",
        "let", "ll", "m", "ma", "me", "mightn", "more", "most", "mustn", "my", "myself",
        "needn", "no", "nor", "not", "now", "o", "of", "off", "on", "once", "only", "or",
        "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "re", "s",
        "same", "shan", "she", "should", "shouldn", "so", "some", "such", "t", "than",
        "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these",
        "they", "this", "those", "through", "to", "too", "under", "until", "up", "ve",
        "very", "was", "wasn", "we", "were", "weren", "what", "when", "where", "which",
        "while", "who", "whom", "why", "will", "with", "won", "would", "wouldn", "y",
        "you", "your", "yours", "yourself", "yourselves",
        // common contractions stripped of apostrophes
        "im", "ive", "id", "ill", "youre", "youve", "youll", "youd", "hes", "shes",
        "its", "weve", "well", "wed", "theyre", "theyve", "theyll", "theyd",
        "dont", "doesnt", "didnt", "wont", "wouldnt", "couldnt", "shouldnt",
        "isnt", "arent", "wasnt", "werent", "hasnt", "havent", "hadnt", "cant", "thats",
        // generic conversational filler
        "yeah", "yes", "no", "oh", "uh", "um", "hey", "okay", "ok", "well", "now", "just",
        "like", "got", "get", "go", "going", "gonna", "wanna", "back", "right", "really",
        "one", "two", "see", "know", "think", "say", "said", "tell", "told", "come", "came",
        "thing", "things"
    ]);

    // Strip stage directions like "[Sokka frowns.]" and "(whispering)" — these are not dialogue.
    // Keep the rest, lowercased.
    function cleanLine(text) {
        return String(text || "")
            .replace(/\[[^\]]*\]/g, " ")
            .replace(/\([^)]*\)/g, " ")
            .toLowerCase();
    }

    // Tokenize a cleaned line into word tokens. Strips punctuation but keeps internal apostrophes,
    // then drops the apostrophes so "don't" -> "dont" matches the stop-word list.
    function tokenize(text) {
        const cleaned = cleanLine(text);
        const tokens = cleaned.match(/[a-z]+(?:'[a-z]+)?/g) || [];
        return tokens.map(t => t.replace(/'/g, ""));
    }

    function isContentWord(token) {
        if (!token || token.length < 3) return false;
        if (STOP_WORDS.has(token)) return false;
        return true;
    }

    // Return Map<word, count> for the supplied rows (already filtered by season + character).
    function wordCounts(rows) {
        const counts = new Map();
        for (const row of rows) {
            const tokens = tokenize(row.SCRIPT);
            for (const tok of tokens) {
                if (!isContentWord(tok)) continue;
                counts.set(tok, (counts.get(tok) || 0) + 1);
            }
        }
        return counts;
    }

    // Return n-gram counts (length 2..maxN). Stop-words are kept inside phrases so things like
    // "the avatar" or "good news everyone" stay intact, but a phrase that is *entirely* stop-words
    // is dropped. Phrases must repeat at least minCount times to be returned.
    function phraseCounts(rows, { maxN = 4, minCount = 3 } = {}) {
        const counts = new Map();
        for (const row of rows) {
            const tokens = tokenize(row.SCRIPT);
            for (let n = 2; n <= maxN; n++) {
                for (let i = 0; i + n <= tokens.length; i++) {
                    const slice = tokens.slice(i, i + n);
                    if (slice.every(t => STOP_WORDS.has(t) || t.length < 3)) continue;
                    const phrase = slice.join(" ");
                    counts.set(phrase, (counts.get(phrase) || 0) + 1);
                }
            }
        }
        // Drop strict sub-phrases whose count equals a containing super-phrase
        // (e.g. drop "good news" if "good news everyone" has the same count).
        const entries = Array.from(counts.entries()).filter(([, c]) => c >= minCount);
        entries.sort((a, b) => b[0].split(" ").length - a[0].split(" ").length);
        const kept = new Map();
        for (const [phrase, count] of entries) {
            let redundant = false;
            for (const [biggerPhrase, biggerCount] of kept) {
                if (biggerCount === count && biggerPhrase.includes(phrase)) {
                    redundant = true;
                    break;
                }
            }
            if (!redundant) kept.set(phrase, count);
        }
        return kept;
    }

    // Distinct, sorted character roster from the dataset, with per-character line totals.
    // Excludes empty Character (scene description rows).
    function characterRoster(rows, { minLines = 30 } = {}) {
        const totals = new Map();
        for (const row of rows) {
            const c = row.CHARACTER;
            if (!c) continue;
            totals.set(c, (totals.get(c) || 0) + 1);
        }
        return Array.from(totals.entries())
            .filter(([, n]) => n >= minLines)
            .sort((a, b) => b[1] - a[1])
            .map(([name, lines]) => ({ name, lines }));
    }

    function rowsForCharacter(rows, characterName) {
        return rows.filter(r => r.CHARACTER === characterName);
    }

    function topEntries(map, n) {
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, n);
    }

    global.TextAnalysis = {
        STOP_WORDS,
        tokenize,
        wordCounts,
        phraseCounts,
        characterRoster,
        rowsForCharacter,
        topEntries
    };
})(window);
