(function(){

    //pseudo-global variables
    var attrArray = ["per_Russian", "per_Tatar", "per_Ukrainian", "per_Armenian", "per_German"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    
    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){
        //map frame dimensions
        var width = window.innerWidth * 0.5,
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
            var csvData = data[0], russia = data[1];     
            //translate russia TopoJSON
            var russiaFedSubjects = topojson.feature(russia, russia.objects.russiaStatesv3).features;
            russiaFedSubjects = joinData(russiaFedSubjects, csvData);
            var colorScale = makeColorScale(csvData);
	        setEnumerationUnits(russiaFedSubjects,map,path,colorScale);
            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        };
    }

    function joinData(russiaFedSubjects, csvData){
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvFedSub = csvData[i]; //the current federal subject
            var csvKey = csvFedSub.Federal_Subject; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<russiaFedSubjects.length; a++){

                var geojsonProps = russiaFedSubjects[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.name_en; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvFedSub[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return russiaFedSubjects;
    }

    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#FEC3C3",
            "#EA7A7A",
            "#D83F3F",
            "#BF1010",
            "#8A0202"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };

    function setEnumerationUnits(russiaFedSubjects,map,path,colorScale){

        //add russia federal subjects to map
        var fedSubjects = map.selectAll(".fedSubjects")
            .data(russiaFedSubjects)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "fedSubjects " + d.properties.Federal_Subject;
            })
            .attr("d", path)
            .style("fill", function(d){
                var value = d.properties[expressed];
                if(value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            });
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 500,
            leftPadding = 25,
            rightPadding = 5,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 100]);

        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return parseFloat(b[expressed])-parseFloat(a[expressed])
            })
            .attr("class", function(d){
                return "bar " + d.Federal_Subject;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){
                return colorScale(parseFloat(d[expressed]));
            });

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 275)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Percentage Russian of each federal subject"); /*+ expressed +*/

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    };
})();