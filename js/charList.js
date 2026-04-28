// charList: Vertical scrollable list of selectable char profiles
// when a profile is selected, information about the character is displayed/updated in another section 

class charList {
    constructor(_config, _data) {
        this.parentElement = document.querySelector(_config.parentElement);
        this.data = _data;

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Create container
        vis.container = document.createElement("div");
        vis.container.classList.add("char-list");

        vis.parentElement.appendChild(vis.container);

        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        let selectedCharacter = window.CharacterWords?.getSelectedCharacter?.() || vis.data[0]?.name || null;

        if (selectedCharacter && !vis.data.some(char => char.name === selectedCharacter) && vis.data.length) {
            selectedCharacter = vis.data[0].name;
            window.CharacterWords?.setSelectedCharacter?.(selectedCharacter);
        }

        // Clear existing content
        vis.container.innerHTML = "";

        vis.data.forEach(char => {
            const card = document.createElement("button");
            card.type = "button";
            card.classList.add("char-profile");
            if (char.name === selectedCharacter) {
                card.classList.add("is-selected");
            }

            card.innerHTML = `
                <h3>${char.name}</h3>
                <p>Lines: ${char.lineCount}</p>
                <p>Episodes: ${char.episodes.join(", ")}</p>
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