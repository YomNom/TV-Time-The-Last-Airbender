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

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Clear existing content
        vis.container.innerHTML = "";

        vis.data.forEach(char => {
            const card = document.createElement("div");
            card.classList.add("char-profile");

            card.innerHTML = `
                <h3>${char.name}</h3>
                <p>Lines: ${char.lineCount}</p>
                <p>Episodes: ${char.episodes.join(", ")}</p>
            `;

            // Optional: click interaction
            card.addEventListener("click", () => {
                console.log(char); // replace with real behavior
            });

            vis.container.appendChild(card);
        });
    }
}