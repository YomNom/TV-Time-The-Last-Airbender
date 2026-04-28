// charList: Vertical scrollable list of selectable char profiles
// when a profile is selected, information about the character is displayed/updated in another section 

class charList {
    constructor(_config, _data) {
        this.parentElement = document.querySelector(_config.parentElement);
        this.data = _data;
        this.searchQuery = "";

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Create container
        vis.container = document.createElement("div");
        vis.container.classList.add("char-list");

        vis.parentElement.appendChild(vis.container);

        // Wire up the search input (lives in index.html, hooked up exactly once).
        const searchInput = document.getElementById("char-search");
        if (searchInput && !searchInput.dataset.charSearchBound) {
            searchInput.dataset.charSearchBound = "1";
            searchInput.addEventListener("input", () => {
                vis.searchQuery = searchInput.value.trim().toLowerCase();
                vis.renderVis();
            });
        }

        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        let selectedCharacter = window.CharacterWords?.getSelectedCharacter?.() || vis.data[0]?.name || null;

        if (selectedCharacter && !vis.data.some(char => char.name === selectedCharacter) && vis.data.length) {
            selectedCharacter = vis.data[0].name;
            window.CharacterWords?.setSelectedCharacter?.(selectedCharacter);
        }

        // Rank is based on the full sorted ranking, so it stays meaningful when filtered.
        const filtered = vis.searchQuery
            ? vis.data.filter(c => c.name.toLowerCase().includes(vis.searchQuery))
            : vis.data;

        // Clear existing content
        vis.container.innerHTML = "";

        if (!filtered.length) {
            const empty = document.createElement("p");
            empty.className = "char-list-empty";
            empty.textContent = vis.searchQuery
                ? `No characters match “${vis.searchQuery}”.`
                : "No characters in this selection.";
            vis.container.appendChild(empty);
            return;
        }

        filtered.forEach(char => {
            const rank = vis.data.indexOf(char) + 1;
            const card = document.createElement("button");
            card.type = "button";
            card.classList.add("char-profile");
            if (char.name === selectedCharacter) {
                card.classList.add("is-selected");
            }

            card.innerHTML = `
                <span class="char-rank">#${rank}</span>
                <span class="char-body">
                    <h3>${char.name}</h3>
                    <p>Lines: ${char.lineCount}</p>
                    <p>Episodes: ${char.episodes.join(", ")}</p>
                </span>
            `;

            // click interaction
            card.addEventListener("click", () => {
                window.CharacterWords?.setSelectedCharacter?.(char.name);
                vis.container.querySelectorAll(".char-profile").forEach(el => el.classList.remove("is-selected"));
                card.classList.add("is-selected");
            });

            vis.container.appendChild(card);
        });
    }
}