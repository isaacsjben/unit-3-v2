//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //use Promise.all to parallelize asynchronous data loading
    var promises = [d3.csv("data/russiandata.csv"),                    
                    d3.json("data/russiastates_reprojected.topojson"),              
                    ];    
    Promise.all(promises).then(callback);
    
    function callback(data){    
        csvData = data[0];    
        russia = data[1];    
        console.log(csvData);
        console.log(russia);    
    };
};