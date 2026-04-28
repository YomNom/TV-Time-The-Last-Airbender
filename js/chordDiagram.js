(function () {
    const TOP_N = 12;

    // named colors for known characters, fallback list for anyone else
    const CHAR_COLORS = {
        'AANG':       '#f5a623',
        'KATARA':     '#4a90d9',
        'SOKKA':      '#2c6e91',
        'ZUKO':       '#c0392b',
        'IROH':       '#e67e22',
        'TOPH':       '#27ae60',
        'AZULA':      '#8e44ad',
        'OZAI':       '#7b241c',
        'SUKI':       '#16a085',
        'JET':        '#795548',
        'MAI':        '#546e7a',
        'TY LEE':     '#ec407a',
        'HAKODA':     '#1a5276',
        'ROKU':       '#d4ac0d',
        'BUMI':       '#6d4c41',
        'ZHAO':       '#c0392b',
        'LONG FENG':  '#4a235a',
    };
    const FALLBACK_COLORS = [
        '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
        '#3498db','#9b59b6','#fd79a8','#00b894','#6c5ce7',
        '#fab1a0','#74b9ff'
    ];

    let _currentData = [];
    let _currentEpisode = 'all';

    function charColor(name, index) {
        return CHAR_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    }

    function buildMatrix(data, episodeFilter) {
        let rows = data.filter(d => d.CHARACTER && d.CHARACTER.trim() !== '');
        if (episodeFilter !== 'all') {
            rows = rows.filter(d => d.TOTAL_NUMBER === +episodeFilter);
        }
        if (rows.length === 0) return { matrix: [], characters: [] };

        // rank characters by how many lines they have, keep the top N
        const counts = new Map();
        rows.forEach(d => {
            const c = d.CHARACTER.toUpperCase().trim();
            counts.set(c, (counts.get(c) || 0) + 1);
        });
        const topChars = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP_N)
            .map(([c]) => c);

        const idx = new Map(topChars.map((c, i) => [c, i]));
        const n = topChars.length;
        const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

        // bucket lines by episode so we can walk each one in order
        const byEp = new Map();
        rows.forEach(d => {
            const key = d.TOTAL_NUMBER;
            if (!byEp.has(key)) byEp.set(key, []);
            byEp.get(key).push(d.CHARACTER.toUpperCase().trim());
        });

        byEp.forEach(lines => {
            // skip minor characters, then count back-and-forth pairs
            const speakers = lines.filter(c => idx.has(c));
            for (let i = 0; i < speakers.length - 1; i++) {
                const a = speakers[i], b = speakers[i + 1];
                if (a !== b) {
                    matrix[idx.get(a)][idx.get(b)]++;
                    matrix[idx.get(b)][idx.get(a)]++;
                }
            }
        });

        return { matrix, characters: topChars };
    }

    function populateEpisodeDropdown(data) {
        const sel = document.getElementById('chord-episode-select');
        if (!sel) return;

        const prev = sel.value;
        sel.innerHTML = '<option value="all">All Episodes</option>';

        // build a sorted, deduplicated list of episodes for the dropdown
        const seen = new Set();
        const eps = [];
        data.filter(d => d.CHARACTER && d.CHARACTER.trim())
            .forEach(d => {
                if (!seen.has(d.TOTAL_NUMBER)) {
                    seen.add(d.TOTAL_NUMBER);
                    eps.push({ total: d.TOTAL_NUMBER, ep: d.EP_NUMBER, book: d.BOOK });
                }
            });
        eps.sort((a, b) => a.total - b.total);

        eps.forEach(({ total, ep, book }) => {
            const opt = document.createElement('option');
            opt.value = total;
            opt.textContent = `S${book}, Ep${ep} (${total})`;
            sel.appendChild(opt);
        });

        const stillValid = [...sel.options].some(o => o.value === prev);
        sel.value = stillValid ? prev : 'all';
        _currentEpisode = sel.value;
    }

    function draw(data) {
        const { matrix, characters } = buildMatrix(data, _currentEpisode);
        const container = d3.select('#chord-diagram');
        container.selectAll('*').remove();

        if (!characters.length || matrix.every(row => row.every(v => v === 0))) {
            container.append('p')
                .style('color', '#aaa')
                .style('padding', '20px')
                .text('No interaction data for the selected filters.');
            return;
        }

        const W = 700, H = 700;
        const outerR = 240;
        const innerR = 216;

        const svg = container.append('svg')
            .attr('width', W)
            .attr('height', H)
            .append('g')
            .attr('transform', `translate(${W / 2},${H / 2})`);

        const chordLayout = d3.chord()
            .padAngle(0.04)
            .sortSubgroups(d3.descending);

        const chords = chordLayout(matrix);

        const arc = d3.arc().innerRadius(innerR).outerRadius(outerR);
        const ribbon = d3.ribbon().radius(innerR);

        const colorOf = (i) => charColor(characters[i], i);
        const tooltip = d3.select('#tooltip');

        // one arc per character around the outside
        const group = svg.append('g')
            .selectAll('g')
            .data(chords.groups)
            .enter().append('g');

        group.append('path')
            .attr('d', arc)
            .style('fill', d => colorOf(d.index))
            .style('stroke', d => d3.rgb(colorOf(d.index)).darker(0.6))
            .on('mouseover', (event, d) => {
                tooltip.style('display', 'block')
                    .html(`<strong>${characters[d.index]}</strong><br>${d.value} dialogue exchanges`);
            })
            .on('mousemove', event => {
                tooltip.style('left', (event.pageX + 14) + 'px')
                    .style('top',  (event.pageY - 30) + 'px');
            })
            .on('mouseout', () => tooltip.style('display', 'none'));

        // character name labels just outside each arc
        group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', '0.35em')
            .attr('transform', d => [
                `rotate(${d.angle * 180 / Math.PI - 90})`,
                `translate(${outerR + 10})`,
                d.angle > Math.PI ? 'rotate(180)' : ''
            ].join(''))
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .text(d => characters[d.index]);

        // ribbons connecting characters — thicker = more exchanges
        svg.append('g')
            .attr('fill-opacity', 0.65)
            .selectAll('path')
            .data(chords)
            .enter().append('path')
            .attr('d', ribbon)
            .style('fill', d => colorOf(d.target.index))
            .style('stroke', d => d3.rgb(colorOf(d.target.index)).darker(0.6))
            .on('mouseover', (event, d) => {
                const a = characters[d.source.index];
                const b = characters[d.target.index];
                tooltip.style('display', 'block')
                    .html(`<strong>${a} ↔ ${b}</strong><br>${d.source.value} exchanges`);
            })
            .on('mousemove', event => {
                tooltip.style('left', (event.pageX + 14) + 'px')
                    .style('top',  (event.pageY - 30) + 'px');
            })
            .on('mouseout', () => tooltip.style('display', 'none'));
    }


    window.initChordDiagram = function (data) {
        _currentData = data;
        populateEpisodeDropdown(data);

        const sel = document.getElementById('chord-episode-select');
        if (sel) {
            sel.addEventListener('change', () => {
                _currentEpisode = sel.value;
                draw(_currentData);
            });
        }

        draw(_currentData);
    };

    window.updateChordDiagram = function (filteredData) {
        _currentData = filteredData;
        populateEpisodeDropdown(filteredData);
        draw(_currentData);
    };
})();
