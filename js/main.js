let appData = [];

Promise.all([
    d3.csv("data/ATLA-episodes-scripts.csv", d => ({
        CHARACTER: (d.Character || d.CHARACTER || "").trim(),
        SCRIPT: (d.script || d.SCRIPT || "").trim(),
        EP_NUMBER: +(d.ep_number || d.EP_NUMBER),
        BOOK: +(d.Book || d.BOOK),
        TOTAL_NUMBER: +(d.total_number || d.TOTAL_NUMBER)
    })),
]).then(([data]) => {
    appData = data;

    // --- Season Filter --- //
    // All data options are selected by default.
    const seasonFilterArray = Array.from(document.querySelectorAll('input[name="season-select"]'));
    seasonFilterArray.forEach(cb => cb.checked = true);

    updateSeasonStats();

    seasonFilterArray.forEach(cb => {
        cb.addEventListener('change', updateSeasonStats);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});

function selectAllSeasons() {
    const seasonFilterArray = Array.from(document.querySelectorAll('input[name="season-select"]'));
    seasonFilterArray.forEach(cb => cb.checked = true);
    updateSeasonStats();
}

function getSelectedSeasons() {
    return Array.from(document.querySelectorAll('input[name="season-select"]:checked'))
        .map(cb => +cb.value);
}

function updateSeasonStats() {
    const selectedSeasons = getSelectedSeasons();
    const filteredData = getDataForSeason(appData, selectedSeasons);
    renderSeasonStats(filteredData);
}

/*
    FOR TESTING
    - displays season stats for each season
*/
function buildSeasonStats(data) {
    const seasons = Array.from(new Set(data.map(d => d.BOOK))).sort((a, b) => a - b);

    return seasons.map(season => {
        const seasonData = data.filter(d => d.BOOK === season);
        const episodeCount = new Set(seasonData.map(d => d.EP_NUMBER)).size;
        const lineCount = seasonData.length;
        const lineCounts = new Map();

        seasonData.forEach(d => {
            const line = d.SCRIPT;
            lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
        });

        const topLines = Array.from(lineCounts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 10)
            .map(([line, count]) => ({ line, count }));

        return {
            season,
            episodeCount,
            lineCount,
            topLines
        };
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderSeasonStats(data) {
    const container = document.getElementById("season-stats-content");
    if (!container) {
        return;
    }

    if (!data.length) {
        container.innerHTML = "<p>No seasons selected.</p>";
        return;
    }

    const stats = buildSeasonStats(data);
    container.innerHTML = stats.map(season => `
        <article class="season-stat-card">
            <h3>Season ${season.season}</h3>
            <p>Episodes: ${season.episodeCount}</p>
            <p>Lines: ${season.lineCount}</p>
            <h4>Top 10 Lines</h4>
            <ol>
                ${season.topLines.map(item => `<li><span>${escapeHtml(item.line)}</span> <strong>(${item.count})</strong></li>`).join("")}
            </ol>
        </article>
    `).join("");
}
//////////////////////////////

function getDataForSeason(data, season) {
    const dataType = new Set(season.map(Number));
    const newData = data.filter(d => dataType.has(d.BOOK)); // Retrives data for selected seasons
    
    // Cleans and converts data to valid types
    newData.forEach(d => {
        d.CHARACTER = d.CHARACTER.trim(); 
        d.SCRIPT = d.SCRIPT.trim();
        d.EP_NUMBER = +d.EP_NUMBER; 
        d.BOOK = +d.BOOK; 
        d.TOTAL_NUMBER = +d.TOTAL_NUMBER;
    });

    return newData;
}

function selectSeasonLines(data) {
    const seasonFilterArray = Array.from(document.querySelectorAll('input[name="season-select"]:checked'))
        .map(cb => +cb.value); // Get values of checked checkboxes

    // Makes sure a season is selected
    if (!seasonFilterArray.length) { return [];}

    return Array.from(new Set(data.filter(d => seasonFilterArray.includes(d.BOOK)).map(d => d.SCRIPT)));
}