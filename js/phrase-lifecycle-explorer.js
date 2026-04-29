const phraseExplorer = (() => {
    let data = [];

    const TIMELINE_MARGIN = { top: 30, right: 40, bottom: 50, left: 55 };
    const TIMELINE_W = 660 - TIMELINE_MARGIN.left - TIMELINE_MARGIN.right;
    const TIMELINE_H = 280 - TIMELINE_MARGIN.top - TIMELINE_MARGIN.bottom;

    const BAR_MARGIN = { top: 10, right: 50, bottom: 30, left: 110 };
    /* Match the timeline's outer width (660) so the two charts stack at uniform width. */
    const BAR_W = 660 - BAR_MARGIN.left - BAR_MARGIN.right;
    const BAR_ROW_H = 28;

    const COLOR_GOLD = "#f0a500";
    const COLOR_RUST = "#b1591a";
    const TOTAL_EPISODES = 61;

    const EXAMPLES = ["honor", "destiny", "my cabbages", "Appa"];

    // Ordered longest-first so "tions" is stripped before "ions", etc.
    const SUFFIX_STRIP = ["tions", "tion", "ments", "ment", "ness", "ings", "ing", "ers", "er", "edly", "ed", "ies", "es", "ly", "s"];
    const SUFFIX_EXPAND = "(?:ing|ings|ed|er|ers|s|es|tion|tions|ness|ment|ments|ly|ful|less|ier|iest|ied|ies)?";

    // ── Init ──────────────────────────────────────────────────────────────────

    function init(csvData) {
        data = csvData;
        initExamples();
        document.getElementById("phrase-search-btn").addEventListener("click", runSearch);
        document.getElementById("phrase-input").addEventListener("keydown", e => {
            if (e.key === "Enter") runSearch();
        });
        // Re-run search immediately when the toggle flips so results stay in sync
        document.getElementById("phrase-stem-toggle").addEventListener("change", () => {
            if (document.getElementById("phrase-input").value.trim()) runSearch();
        });
        initTimeline();
    }

    function initExamples() {
        const container = document.getElementById("phrase-examples");
        container.innerHTML = EXAMPLES.map(ex =>
            `<button class="phrase-chip" data-phrase="${escapeHtml(ex)}">${escapeHtml(ex)}</button>`
        ).join("");
        container.querySelectorAll(".phrase-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("phrase-input").value = btn.dataset.phrase;
                runSearch();
            });
        });
    }

    // ── Search ────────────────────────────────────────────────────────────────

    function runSearch() {
        const raw = document.getElementById("phrase-input").value.trim();
        if (!raw) return;
        const useRelatedForms = document.getElementById("phrase-stem-toggle").checked;
        const { episodeData, characterData, metrics } = searchPhrase(raw, useRelatedForms);
        renderSummary(metrics);
        renderTimeline(episodeData, metrics);
        renderCharacterChart(characterData);
    }

    function getStem(word) {
        const w = word.toLowerCase();
        for (const suffix of SUFFIX_STRIP) {
            if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
                return w.slice(0, w.length - suffix.length);
            }
        }
        return w;
    }

    function buildRegex(phrase, useRelatedForms) {
        const isMultiWord = /\s/.test(phrase.trim());
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // All modes anchor at word boundaries to prevent partial-word false positives
        // (e.g. "my cabbages" must not match inside "tummy cabbages").
        // Single word, exact: \bphrase\b
        // Multi-word: \bphrase\b — same boundaries, phrase-internal spaces match literally
        // Single word, related forms: \bstem<suffix>?\b
        if (isMultiWord || !useRelatedForms) {
            return new RegExp(`\\b${escaped}\\b`, "gi");
        }

        const stem = getStem(phrase.toLowerCase());
        const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escapedStem}${SUFFIX_EXPAND}\\b`, "gi");
    }

    function searchPhrase(phrase, useRelatedForms = false) {
        const regex = buildRegex(phrase, useRelatedForms);

        const epMap = new Map();
        const charMap = new Map();

        data.forEach(row => {
            // matchAll() uses an internal regex clone with lastIndex=0 on every call,
            // avoiding the stale-lastIndex bug that can affect reused global regexes.
            const count = [...row.SCRIPT.matchAll(regex)].length;
            if (!count) return;

            const ep = row.TOTAL_NUMBER;
            epMap.set(ep, (epMap.get(ep) || 0) + count);

            if (row.CHARACTER) {
                charMap.set(row.CHARACTER, (charMap.get(row.CHARACTER) || 0) + count);
            }
        });

        const episodeData = Array.from({ length: TOTAL_EPISODES }, (_, i) => ({
            ep: i + 1,
            count: epMap.get(i + 1) || 0
        }));

        const activeEps = episodeData.filter(d => d.count > 0);
        const firstEp = activeEps.length ? activeEps[0].ep : null;
        const lastEp = activeEps.length ? activeEps[activeEps.length - 1].ep : null;
        const totalMentions = activeEps.reduce((s, d) => s + d.count, 0);

        const characterData = Array.from(charMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const topSpeaker = characterData.length ? characterData[0].name : null;

        return {
            episodeData,
            characterData,
            metrics: { firstEp, lastEp, totalMentions, topSpeaker, phrase, useRelatedForms }
        };
    }

    // ── Summary pills ─────────────────────────────────────────────────────────

    function renderSummary({ firstEp, lastEp, totalMentions, topSpeaker, phrase, useRelatedForms }) {
        const container = document.getElementById("phrase-summary");
        const modeTag = useRelatedForms
            ? `<span class="phrase-pill phrase-pill--mode">~word forms</span>`
            : "";
        if (firstEp === null) {
            container.innerHTML = `<span class="phrase-pill phrase-pill--none">No results for "${escapeHtml(phrase)}"</span>${modeTag}`;
            return;
        }
        container.innerHTML = `
            <span class="phrase-pill">First: Ep ${firstEp}</span>
            <span class="phrase-pill">Last: Ep ${lastEp}</span>
            <span class="phrase-pill">Total: ${totalMentions} mention${totalMentions !== 1 ? "s" : ""}</span>
            ${topSpeaker ? `<span class="phrase-pill">Top speaker: ${escapeHtml(topSpeaker)}</span>` : ""}
            ${modeTag}
        `;
    }

    // ── Timeline ──────────────────────────────────────────────────────────────

    function initTimeline() {
        const container = d3.select("#phrase-timeline");
        const svg = container.append("svg")
            .attr("width", TIMELINE_W + TIMELINE_MARGIN.left + TIMELINE_MARGIN.right)
            .attr("height", TIMELINE_H + TIMELINE_MARGIN.top + TIMELINE_MARGIN.bottom);

        const g = svg.append("g")
            .attr("class", "timeline-g")
            .attr("transform", `translate(${TIMELINE_MARGIN.left},${TIMELINE_MARGIN.top})`);

        svg.append("defs").append("clipPath")
            .attr("id", "timeline-clip")
            .append("rect")
            .attr("width", TIMELINE_W)
            .attr("height", TIMELINE_H);

        g.append("g").attr("class", "axis axis--x")
            .attr("transform", `translate(0,${TIMELINE_H})`);
        g.append("g").attr("class", "axis axis--y");

        g.append("text")
            .attr("class", "axis-label")
            .attr("x", TIMELINE_W / 2)
            .attr("y", TIMELINE_H + 42)
            .attr("text-anchor", "middle")
            .text("Episode (series order)");

        g.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -TIMELINE_H / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .text("Mentions per episode");

        g.append("g").attr("class", "line-group")
            .attr("clip-path", "url(#timeline-clip)")
            .append("path")
            .attr("class", "phrase-line")
            .attr("fill", "none")
            .attr("stroke", COLOR_GOLD)
            .attr("stroke-width", 2.5);

        g.append("g").attr("class", "dots-group");
        g.append("g").attr("class", "markers-group");
    }

    function renderTimeline(episodeData, { firstEp, lastEp }) {
        const g = d3.select(".timeline-g");

        const xScale = d3.scaleLinear()
            .domain([1, TOTAL_EPISODES])
            .range([0, TIMELINE_W]);

        const maxCount = d3.max(episodeData, d => d.count) || 1;
        const yScale = d3.scaleLinear()
            .domain([0, maxCount])
            .nice()
            .range([TIMELINE_H, 0]);

        const t = d3.transition().duration(600).ease(d3.easeCubicInOut);

        g.select(".axis--x")
            .transition(t)
            .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.format("d")));

        g.select(".axis--y")
            .transition(t)
            .call(d3.axisLeft(yScale).ticks(5));

        const lineGen = d3.line()
            .x(d => xScale(d.ep))
            .y(d => yScale(d.count))
            .curve(d3.curveMonotoneX);

        g.select(".phrase-line")
            .datum(episodeData)
            .transition(t)
            .attr("d", lineGen);

        const activeDots = episodeData.filter(d => d.count > 0);
        const tooltip = d3.select("#tooltip");

        const dots = g.select(".dots-group")
            .selectAll("circle.dot")
            .data(activeDots, d => d.ep);

        dots.enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 4)
            .attr("cx", d => xScale(d.ep))
            .attr("cy", yScale(0))
            .attr("fill", COLOR_GOLD)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1)
                    .html(`Ep ${d.ep} — ${d.count} mention${d.count !== 1 ? "s" : ""}`);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .transition(t)
            .attr("cy", d => yScale(d.count));

        dots.transition(t)
            .attr("cx", d => xScale(d.ep))
            .attr("cy", d => yScale(d.count));

        dots.exit()
            .transition(t)
            .attr("cy", yScale(0))
            .remove();

        const markerData = [];
        if (firstEp !== null) markerData.push({ ep: firstEp, type: "first" });
        if (lastEp !== null && lastEp !== firstEp) markerData.push({ ep: lastEp, type: "last" });

        const epLookup = new Map(episodeData.map(d => [d.ep, d.count]));

        const markers = g.select(".markers-group")
            .selectAll("circle.marker")
            .data(markerData, d => d.type);

        markers.enter()
            .append("circle")
            .attr("class", "marker")
            .attr("r", 8)
            .attr("cx", d => xScale(d.ep))
            .attr("cy", yScale(0))
            .attr("fill", d => d.type === "first" ? COLOR_GOLD : COLOR_RUST)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .on("mouseover", (event, d) => {
                const count = epLookup.get(d.ep) || 0;
                tooltip.style("opacity", 1)
                    .html(`${d.type === "first" ? "First" : "Last"} — Ep ${d.ep} (${count} mention${count !== 1 ? "s" : ""})`);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .transition(t)
            .attr("cy", d => yScale(epLookup.get(d.ep) || 0));

        markers.transition(t)
            .attr("cx", d => xScale(d.ep))
            .attr("cy", d => yScale(epLookup.get(d.ep) || 0));

        markers.exit().remove();
    }

    // ── Character Bar Chart ───────────────────────────────────────────────────

    function renderCharacterChart(characterData) {
        const container = d3.select("#phrase-characters");
        container.selectAll("*").remove();

        if (!characterData.length) return;

        const barH = BAR_ROW_H * characterData.length;
        const totalH = barH + BAR_MARGIN.top + BAR_MARGIN.bottom;

        const svg = container.append("svg")
            .attr("width", BAR_W + BAR_MARGIN.left + BAR_MARGIN.right)
            .attr("height", totalH);

        const g = svg.append("g")
            .attr("transform", `translate(${BAR_MARGIN.left},${BAR_MARGIN.top})`);

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(characterData, d => d.count)])
            .nice()
            .range([0, BAR_W]);

        const yScale = d3.scaleBand()
            .domain(characterData.map(d => d.name))
            .range([0, barH])
            .paddingInner(0.25);

        g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${barH})`)
            .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.format("d")));

        g.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(yScale).tickSize(0))
            .select(".domain").remove();

        const t = d3.transition().duration(500).ease(d3.easeCubicOut);

        g.selectAll("rect.bar")
            .data(characterData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("y", d => yScale(d.name))
            .attr("x", 0)
            .attr("height", yScale.bandwidth())
            .attr("width", 0)
            .attr("fill", COLOR_GOLD)
            .attr("rx", 3)
            .transition(t)
            .attr("width", d => xScale(d.count));

        g.selectAll("text.bar-label")
            .data(characterData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2 + 4)
            .attr("x", d => xScale(d.count) + 5)
            .attr("font-size", "12px")
            .attr("fill", "#333")
            .text(d => d.count);
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    return { init };
})();
