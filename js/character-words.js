// Level 2, Option 1: "What do characters say?"
// Renders the character picker, word cloud, top-words bars, and common-phrases list.
// Exposes window.CharacterWords with init(allRows) + update(filteredRows).
(function (global) {
    "use strict";

    const ROSTER_MIN_LINES = 30;
    const TOP_WORDS_FOR_CLOUD = 80;
    const TOP_WORDS_FOR_BARS = 15;
    const TOP_PHRASES = 12;

    // ATLA element-ish palette. Chosen to read clearly against the dark panel.
    const PALETTE = ["#f0a500", "#b1591a", "#3b82f6", "#10b981", "#a855f7", "#ef4444"];

    let allRows = [];
    let selectedCharacter = null;
    // Stable roster ordered by full-series line totals — list order shouldn't shuffle
    // when the user toggles seasons; only the per-character visuals update.
    let roster = [];

    function init(rows) {
        allRows = rows;
        roster = getCharactersAndTheirLines(rows);
        if (!roster.length) return;
        selectedCharacter = roster[0].name;
    }

    // Called by main.js whenever the season filter changes.
    function update(filteredRows) {
        currentFiltered = filteredRows;
        refresh();
    }

    let currentFiltered = [];

    function setSelectedCharacter(name) {
        if (!name || name === selectedCharacter) return;
        selectedCharacter = name;
        refresh();
    }

    function getSelectedCharacter() {
        return selectedCharacter;
    }

    function refresh() {
        if (!selectedCharacter) return;
        const charRows = TextAnalysis.rowsForCharacter(currentFiltered, selectedCharacter);

        const caption = document.getElementById("cloud-caption");
        if (caption) {
            caption.textContent = charRows.length
                ? `${selectedCharacter} — ${charRows.length} lines in the current selection.`
                : `${selectedCharacter} doesn't appear in the selected seasons.`;
        }

        renderWordCloud(charRows);
        renderTopWordsBars(charRows);
        renderTopPhrases(charRows);
    }

    function renderWordCloud(rows) {
        const container = document.getElementById("word-cloud");
        if (!container) return;
        container.innerHTML = "";

        const counts = TextAnalysis.wordCounts(rows);
        const top = TextAnalysis.topEntries(counts, TOP_WORDS_FOR_CLOUD);
        if (!top.length) {
            container.innerHTML = `<p class="empty">No dialogue in the current selection.</p>`;
            return;
        }

        const width = container.clientWidth || 600;
        const height = 360;
        const maxCount = top[0][1];
        const minCount = top[top.length - 1][1];
        const fontScale = d3.scaleLinear()
            .domain([Math.min(minCount, maxCount), maxCount])
            .range([14, 64]);

        const layoutWords = top.map(([text, count], i) => ({
            text,
            count,
            size: fontScale(count),
            color: PALETTE[i % PALETTE.length]
        }));

        d3.layout.cloud()
            .size([width, height])
            .words(layoutWords)
            .padding(3)
            .rotate(() => (Math.random() < 0.7 ? 0 : 90))
            .font("Trebuchet MS, sans-serif")
            .fontSize(d => d.size)
            .on("end", drawCloud)
            .start();

        function drawCloud(words) {
            const svg = d3.select(container).append("svg")
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("width", "100%")
                .attr("height", height);

            const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

            g.selectAll("text")
                .data(words)
                .enter().append("text")
                .style("font-family", "Trebuchet MS, sans-serif")
                .style("font-weight", "700")
                .style("fill", d => d.color)
                .style("cursor", "default")
                .attr("text-anchor", "middle")
                .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
                .style("font-size", d => `${d.size}px`)
                .text(d => d.text)
                .on("mouseover", (event, d) => showTooltip(event, `<strong>${d.text}</strong><br>${d.count} uses`))
                .on("mousemove", moveTooltip)
                .on("mouseout", hideTooltip);
        }
    }

    function renderTopWordsBars(rows) {
        const container = document.getElementById("top-words");
        if (!container) return;
        container.innerHTML = "";

        const counts = TextAnalysis.wordCounts(rows);
        const top = TextAnalysis.topEntries(counts, TOP_WORDS_FOR_BARS);
        if (!top.length) {
            container.innerHTML = `<p class="empty">No words to show.</p>`;
            return;
        }

        const max = top[0][1];
        const list = document.createElement("ol");
        list.className = "bar-list";
        for (const [word, count] of top) {
            const li = document.createElement("li");
            li.className = "bar-row";
            li.innerHTML = `
                <span class="bar-label">${escapeHtml(word)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${(count / max) * 100}%"></span></span>
                <span class="bar-count">${count}</span>
            `;
            list.appendChild(li);
        }
        container.appendChild(list);
    }

    function renderTopPhrases(rows) {
        const container = document.getElementById("top-phrases");
        if (!container) return;
        container.innerHTML = "";

        const counts = TextAnalysis.phraseCounts(rows, { maxN: 4, minCount: 3 });
        const top = TextAnalysis.topEntries(counts, TOP_PHRASES);
        if (!top.length) {
            container.innerHTML = `<p class="empty">No phrases repeat ≥3 times in the current selection.</p>`;
            return;
        }

        const list = document.createElement("ul");
        list.className = "phrase-list";
        for (const [phrase, count] of top) {
            const li = document.createElement("li");
            li.className = "phrase-row";
            li.innerHTML = `<span class="phrase-text">"${escapeHtml(phrase)}"</span><span class="phrase-count">${count}×</span>`;
            list.appendChild(li);
        }
        container.appendChild(list);
    }

    // Tooltip helpers
    function showTooltip(event, html) {
        const tip = document.getElementById("tooltip");
        if (!tip) return;
        tip.innerHTML = html;
        tip.classList.add("is-visible");
        moveTooltip(event);
    }
    function moveTooltip(event) {
        const tip = document.getElementById("tooltip");
        if (!tip) return;
        tip.style.left = `${event.pageX + 12}px`;
        tip.style.top = `${event.pageY + 12}px`;
    }
    function hideTooltip() {
        const tip = document.getElementById("tooltip");
        if (!tip) return;
        tip.classList.remove("is-visible");
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    global.CharacterWords = { init, update, setSelectedCharacter, getSelectedCharacter };
})(window);
