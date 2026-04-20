Promise.all([
    d3.csv("data/ATLA-episodes-scripts.csv"),
]).then(([data]) => {

}).catch(error => {
    console.error("Error loading data:", error);
});