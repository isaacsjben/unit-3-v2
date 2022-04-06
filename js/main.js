//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = 960,
        height = 500;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([0, 46.2])
        .rotate([-93.55, -22.73, 0])
        .parallels([29.05, 45.5])
        .scale(679.80)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("data/russiandata.csv")); //load attributes from csv    
    promises.push(d3.json("data/russiaStatesv3.topojson")); //load choropleth spatial data                 
    Promise.all(promises).then(callback);
    
    function callback(data){    
        csvData = data[0];    
        russia = data[1];    
        //translate russia TopoJSON
        var russiaFedSubjects = topojson.feature(russia, russia.objects.russiaStatesv3).features;
        console.log(russiaFedSubjects);

        //add France regions to map
        var fedSubjects = map.selectAll(".fedSubjects")
            .data(russiaFedSubjects)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "fedSubjects ";
            })
            .attr("d", path);
    };
};