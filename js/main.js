let scriptData, charAndTheirLines, charObjList;
let charlist, charInfo;

function pickField(row, keys, fallback = "") {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
            return row[key];
        }
    }
    return fallback;
}

Promise.all([
    d3.csv("data/ATLA-episodes-scripts.csv"),
]).then(([data]) => {
    scriptData = data;

    // --- Season Filter --- //
    // All data options are selected by default.
    const seasonFilterArray = Array.from(document.querySelectorAll('input[name="season-select"]'));
    seasonFilterArray.forEach(cb => cb.checked = true);

    // --- Char List Retrieval --- //
    charAndTheirLines = getCharactersAndTheirLines(scriptData); // for line analysis/processing
    charObjList = createCharObjList(charAndTheirLines); // for display
    console.log("CHAR OBJ LIST:", charObjList);

    updateDataBySeason();

    seasonFilterArray.forEach(cb => {
        cb.addEventListener('change', handleSeasonSelectionChange);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});

function renderDisplay(data) {
    // --- Char List Retrieval --- //
    charAndTheirLines = getCharactersAndTheirLines(data); // build from filtered data
    charObjList = createCharObjList(charAndTheirLines); // for display
    console.log("CHAR OBJ LIST:", charObjList);

    if (!charlist) {
        charlist = new charList({
            parentElement: "#char-list"
        }, charObjList);
        return;
    }

    // Reuse existing list container to avoid stacking duplicate panels and scroll jumps.
    charlist.data = charObjList;
    charlist.updateVis();
}

// Displays Data For All Seasons
function selectAllSeasonData() {
    const seasonFilterArray = Array.from(document.querySelectorAll('input[name="season-select"]'));
    seasonFilterArray.forEach(cb => cb.checked = true);
    updateDataBySeason();
}

// Retrieves what seasons are selected by the user 
// OUTPUT: Returns them as an array of numbers
function getSelectedSeasons() {
    return Array.from(document.querySelectorAll('input[name="season-select"]:checked'))
        .map(cb => +cb.value);
}

function handleSeasonSelectionChange(event) {
    const selectedSeasons = getSelectedSeasons();

    // Prevent unchecking the final remaining selected season.
    if (!event.target.checked && selectedSeasons.length === 0) {
        event.target.checked = true;
        return;
    }

    updateDataBySeason();
}

// Updates the data based on the seasons selected by the user
function updateDataBySeason() {
    console.log("scriptData:", scriptData);
    const filteredData = allSelectedData(scriptData);
    console.log("filteredData:", filteredData);
    renderDisplay(filteredData);
}

// Filters and gets the data based on the seasons selected by the user
function getDataForSeason(data, season) {
    const dataType = new Set(season.map(Number));
    const newData = data.filter(d => {
        const book = +pickField(d, ["BOOK", "Book", "book"]);
        return dataType.has(book);
    }); // Retrives data for selected seasons
    
    // Cleans and converts data to valid types
    newData.forEach(d => {
        d.CHARACTER = String(pickField(d, ["CHARACTER", "Character", "character"], "")).trim();
        d.SCRIPT = String(pickField(d, ["SCRIPT", "script"], "")).trim();
        d.EP_NUMBER = +pickField(d, ["EP_NUMBER", "ep_number", "Ep_Number"], 0);
        d.BOOK = +pickField(d, ["BOOK", "Book", "book"], 0);
        d.TOTAL_NUMBER = +pickField(d, ["TOTAL_NUMBER", "total_number", "Total_Number"], 0);
    });

    return newData;
}

// Compiles all selected data into one array 
function allSelectedData(data) {
    const selectedSeasons = getSelectedSeasons();
    const selectedData = [];

    selectedSeasons.forEach(season => {
        const seasonData = getDataForSeason(data, [season]);
        selectedData.push(...seasonData);
    });

    return selectedData;
}

// Gets all unique characters and their lines and stores them in
// OUTPUT: dictionary-like structure where the key is the character and the value is an array of their lines
function getCharactersAndTheirLines(data) {
    const characters = new Map();

    data.forEach(d => {
        const character = String(pickField(d, ["CHARACTER", "Character", "character"], "")).trim();
        if (!character) {
            return;
        }
        if (!characters.has(character)) { // Adds characters not in map
            characters.set(character, []);
        }
        characters.get(character).push(d); // Keep full row so episode metadata is available
    });

    return characters;
}

// Creates objects for each key-value pair in the characters map and stores them in an array
// OUTPUT: Array of objects containing: char name, number of lines, array of episodes they appear in
function createCharObjList(characters) {
    const charObjList = [];

    characters.forEach((lines, character) => {
        const charObj = {
            name: character,
            lineCount: lines.length,
            episodes: new Set(), // Using a set to avoid duplicate episodes
        };
        lines.forEach(row => {
            const episode = row.EP_NUMBER;
            charObj.episodes.add(episode); // Adds the episode to the set of episodes
        });
        charObj.episodes = Array.from(charObj.episodes);
        charObjList.push(charObj);
    });

    return charObjList;
}

