(function(){

    //pseudo-global variables
    var attrArray = ["per_Russian", "per_Tatar", "per_Ukrainian", "per_Armenian", "per_German"]; //list of attributes
    var colors = {
        per_Russian: ["#FEC3C3", "#EA7A7A","#D83F3F", "#BF1010","#8A0202"],
        per_Tatar: ["#e4cbf7", "#c891f0", "#ac5de5", "#8931ca","#5e089d"],
        per_Ukrainian: ["#ced7f7", "#9fb0ef", "#6782e7", "#2c4ecc","#0426a4"],
        per_Armenian: ["#f6e0c8", "#eec495", "#ecb06c", "#e89a42","#b96100"],
        per_German: ["#caf8db", "#8de9b0", "#51d482", "#149545","#096a2d"]
    }
    var expressed = attrArray[0]; //initial attribute
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
    chartHeight = 500,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 110]);
    
    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 500;

        //create new svg container for the map
        var map = d3.select(".myDiv")
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
            createDropdown(csvData)
            changeAttribute(expressed, csvData)
            createLegend(colorScale)
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
                var geojsonKey = geojsonProps.Federal_Subject; //the geojson primary key

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
        var colorClasses = colors[expressed];
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
            })
            .on("mouseover", function(event, d){
                highlight(d.properties);
            })
            .on("mouseout", function(event, d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        var desc = fedSubjects.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}')
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
        var chart = d3.select(".myDiv")
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
            .on("mouseover", function(event, d){
                highlight(d);
            })
            .on("mouseout", function(event, d){
                dehighlight(d);
            })
            .on("mousemove", moveLabel);

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 150)
            .attr("y", 40)
            .attr("class", "chartTitle")
        
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);
            
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

         var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    };

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select(".legendContainer")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d.replace('per_', ''); });
    };
    //dropdown change event handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);
        createLegend(colorScale);
        //recolor enumeration units
        var fedSubjects = d3.selectAll(".fedSubjects")
            .transition()
            .duration(1000)
            .style("fill", function(d){     
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#ccc";
                }
            });

        //Sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
        //Sort bars
        .sort(function(a, b){
            return parseFloat(b[expressed])-parseFloat(a[expressed])
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
        
        updateChart(bars, csvData.length, colorScale);
    };

    function createLegend(colors){
        d3.select(".legendLinear").remove();
        
        var legendsvg = d3.select(".legendContainer")
            .append("svg")
            .attr("class", "legendLinear")

        var legend = d3.legendColor()
            .orient("horizontal") 
            .scale(colors)
            .shapePadding(20)
            .shapeWidth(30)
            .title("Population:")
            .labels(["low", "", "med", "", "hi"]);
        
        legendsvg.append("g")
            .call(legend);
    }

    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){            
                var value = parseFloat(d[expressed]);            
                if(value) {                
                    return colorScale(value);            
                } else {                
                    return "#ccc";            
                }    
            });

        var chartTitle = d3.select(".chartTitle")
            .text("Percentage identifying as "+ expressed.replace('per_', '') + " in each federal subject");
    };

    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.Federal_Subject)
            .style("stroke", "black")
            .style("stroke-width", "2");
        setLabel(props)
    };

    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.Federal_Subject)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        }
        //remove info label
        d3.select(".infolabel").remove();
    };

    //function to create dynamic label
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props[expressed.replace('%', '')] +
            "%</h1><b>" + expressed.replace('per_', '') + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.Federal_Subject + "_label")
            .html(labelAttribute);

        var fedSubName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.Federal_Subject.replaceAll('_', ' '));
    };

    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
    
        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;
    
        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1; 
    
        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

})();