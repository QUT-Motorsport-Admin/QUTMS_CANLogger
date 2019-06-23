var fs = require('fs');
var express = require('express');
const fileUpload = require('express-fileupload');
var csv_export=require('csv-export');
var AdmZip = require('adm-zip');
var LineByLineReader = require('line-by-line');

const port = 4567;

const app = express();

/*
{
    Packetnumber,
    ID,
    flags,
    data
} 
*/

// default options 
app.use(express.static('www'));
app.use(fileUpload());

app.get('/',function(req,res){
    res.redirect('./index.html');
});

app.post('/upload', function(req, res){
    /*
    console.log("UPLOAD");
    console.log(req.files);
    console.log(req.body.type);
    */

    if(req.files == null){
        return res.status(400).send('The file uploaded is empty!');
    }
    
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }

    // The name of the input field (i.e. "fileToUpload") is used to retrieve the uploaded file
    let fileuploaded = req.files.fileToUpload;

    if(!fileuploaded.name.toLowerCase().includes(".txt")){
        return res.status(400).send('We only accept txt files.');
    }

    // Use the mv() method to place the file somewhere on your server
    fileuploaded.mv(fileuploaded.name, function(err) {
        if (err){
            return res.status(500).send(err);
        }

        let numbering = 0;
        let CAN_data_obj = [];
        
        lr = new LineByLineReader(fileuploaded.name);

        lr.on('error', function (err) {
            // 'err' contains error object
            return res.status(500).send(err);
        });

        lr.on('line', function (line) {
            // 'line' contains the current line without the trailing newline character.
            if(line[0] === "P" || line[0] === ' '){
                return;
            }
            line = line.replace(/\s/g,'');
            line = line.split(",");
            let dataString = "0x";
            for(let dataIndex = 0; dataIndex < line[1]; dataIndex++){
                dataString += line[dataIndex + 2];
            }
            numbering++;
            CAN_data_obj.push({
                Packetnumber: numbering,//line[0],
                ID: '0x'+line[0],
                flags: '',//line[2],
                data: dataString
            });
        });

        lr.on('end', function () {
            let fileNameNoExtension = fileuploaded.name.split('.')[0];
            // All lines are read, file is closed now.
            fs.unlinkSync(fileuploaded.name);
            fs.unlinkSync(fileNameNoExtension + ".zip");
            // send Data back
            res.send({CAN_data_obj});
        });
    });
});

app.post('/upload_file', function(req, res) {
    if(req.files == null){
        console.log("file is empty");
        return res.status(400).send('The file uploaded is empty!');
    }
    
    if (Object.keys(req.files).length == 0) {
        console.log("file not uploaded");
        return res.status(400).send('No files were uploaded.');
    }

    // The name of the input field (i.e. "fileToUpload") is used to retrieve the uploaded file
    let fileuploaded = req.files.fileToUpload;
    if(!fileuploaded.name.toLowerCase().includes(".txt")){
        console.log("not txt");
        return res.status(400).send('We only accept txt files.');
    }
    let databaseType = req.body.type;
    // Use the mv() method to place the file somewhere on your server
    fileuploaded.mv(fileuploaded.name, function(err) {
        if (err){
            return res.status(500).send(err);
        }

        let numbering = 0;
        
        if(databaseType === 'csv'){
            let CAN_CSV = [];
        
            lr = new LineByLineReader(fileuploaded.name);

            lr.on('error', function (err) {
                // 'err' contains error object
                console.log(err);
                return res.status(500).send(err);
            });

            lr.on('line', function (line) {
                // 'line' contains the current line without the trailing newline character.
                if(line[0] === "P" || line[0] === ''){
                    return;
                }
                line = line.replace(/\s/g,'');
                line = line.split(",");
                numbering++;
                let databject = 
                {
                    Packetnumber: numbering,//line[0],
                    ID: '0x'+line[0],
                    flags: '',//line[2],
                };
                let dataArray = [];
                let dataString = "0x";
                for(let dataIndex = 0; dataIndex < line[1]; dataIndex++){
                    dataString += line[dataIndex + 2];
                    dataArray.push(line[dataIndex + 2]);
                }
                databject["data"] = dataString;
                for(let dataIndex = 0; dataIndex < dataArray.length; dataIndex++){
                    databject["data " + dataIndex] = dataArray[dataIndex];
                }
                CAN_CSV.push(
                    databject
                );
            });

            lr.on('end', function () {
                // All lines are read, file is closed now.
                // Export Data
                let fileNameNoExtension = fileuploaded.name.split('.')[0];
                csv_export.export({CAN_CSV},function(buffer){
                    //this module returns a buffer for the csv files already compressed into a single zip.
                    //save the zip or force file download via express or other server
                    fs.writeFileSync('./' + fileNameNoExtension + '.zip',buffer);
                    res.download(__dirname + "/" + fileNameNoExtension + ".zip", "CAN_data_CSV.zip");
                });
            });
        }else if(databaseType === "sql"){
            let makeSureDatabase =
            "DROP SCHEMA IF EXISTS `can_logger`;";
            let makeTheDatabase = 
            "CREATE SCHEMA `can_logger`;";
            let useTheDatabase = 
            "USE `can_logger`;";

            let makeTheTable = 
            "CREATE TABLE IF NOT EXISTS `can_data` ( " + 
            "`packetnumber` int(11) NOT NULL AUTO_INCREMENT, "+
            "`id` varchar(10) DEFAULT NULL, "+
            "`flags` varchar(10) DEFAULT NULL, "+
            "`data` varchar(18) DEFAULT NULL, ";
            //"PRIMARY KEY (`packetnumber`) );";

            let insertIntoTheTable = 
            "INSERT INTO `can_data` (`packetnumber`, `id`, `flags`, `data`";

            let numberOfData = 0;
            
            let makeThedata = "";

            lr = new LineByLineReader(fileuploaded.name);

            lr.on('error', function (err) {
                // 'err' contains error object
                return res.status(500).send(err);
            });

            lr.on('line', function (line) {
                // 'line' contains the current line without the trailing newline character.
                if(line[0] === "P"){
                    return;
                }

                line = line.replace(/\s/g,'');
                line = line.split(",");
                numbering++;
                let indecies = 0;
                let dataArray = [];
                let dataString = "0x";

                for(let dataIndex = 0; dataIndex < line[1]; dataIndex++){
                    dataString += line[dataIndex + 2];
                    dataArray.push(line[dataIndex + 2]);
                    indecies++;
                }

                if(numberOfData < indecies){
                    numberOfData = indecies;
                }

               if (makeThedata != ""){
                   makeThedata = makeThedata + ",";
               }
               
               makeThedata = 
               makeThedata +
               `(`+
               ` ${numbering},`+
               ` ${'0x'+line[0]},`+
               ` ' ',`+
               ` '${dataString}',`;
               for(let dataindex = 0; dataindex < dataArray.length; dataindex++){
                   if(dataindex == dataArray.length - 1){
                    makeThedata =
                    makeThedata +
                    `${dataArray[dataindex]})`;
                   }else{
                    makeThedata =
                    makeThedata +
                    ` ${dataArray[dataindex]},`;
                   }
               }
            });

            lr.on('end', function () {
                makeThedata = makeThedata + ";";
                
                for(let indexHeaders = 0; indexHeaders < numberOfData; indexHeaders++){
                    makeTheTable = 
                    makeTheTable +
                    "`data`" + `${indexHeaders}` + " int(10) DEFAULT NULL, ";
                    
                    insertIntoTheTable = 
                    insertIntoTheTable +
                    ", `data" + `${indexHeaders}` + "`";
                }
                makeTheTable =
                makeTheTable +
                "PRIMARY KEY (`packetnumber`) );";

                insertIntoTheTable = 
                insertIntoTheTable +
                ") VALUES ";

                let fullSQLcommand =
                makeSureDatabase + makeTheDatabase +
                useTheDatabase + makeTheTable +
                insertIntoTheTable + makeThedata;

                let fileNameNoExtension = fileuploaded.name.split('.')[0];
                fs.writeFile(fileNameNoExtension + ".sql", fullSQLcommand, function (err) {
                    if (err) return res.status(500).send(err);
                    var zip = new AdmZip();
                    zip.addLocalFile(__dirname + "/" + fileNameNoExtension + ".sql");
                    zip.writeZip(__dirname + "/" + fileNameNoExtension + ".zip");
                    res.download(__dirname + "/" + fileNameNoExtension + ".zip", fileNameNoExtension + ".zip");
                    //fs.unlinkSync(fileNameNoExtension + ".txt");
                    //fs.unlinkSync(fileNameNoExtension + ".sql");
                });
            });
        }else if(databaseType === "nosql"){
        
            let jsonData = "";
            lr = new LineByLineReader(fileuploaded.name);
        
            lr.on('error', function (err) {
                // 'err' contains error object
                return res.status(500).send(err);
            });
        
            lr.on('line', function (line) {
                // 'line' contains the current line without the trailing newline character.
                if(line[0] === "P"){
                    return;
                }
        
                line = line.replace(/\s/g,'');
                line = line.split(",");
                /*
                numbering++;
                let databject = 
                {
                    Packetnumber: numbering,//line[0],
                    ID: '0x'+line[0],
                    flags: '',//line[2],
                };
                let dataArray = [];
                let dataString = "0x";
                for(let dataIndex = 0; dataIndex < line[1]; dataIndex++){
                    dataString += line[dataIndex + 2];
                    dataArray.push(line[dataIndex + 2]);
                }
                databject["data"] = dataString;
                for(let dataIndex = 0; dataIndex < dataArray.length; dataIndex++){
                    databject["data " + dataIndex] = dataArray[dataIndex];
                }
                */
                let dataArray = [];
                let dataString = "0x";
                for(let dataIndex = 0; dataIndex < line[1]; dataIndex++){
                    dataString += line[dataIndex + 2];
                    dataArray.push(line[dataIndex + 2]);
                }
                //numberDouble
                //numberInt
                numbering++;
                jsonData =
                jsonData +
                `{`+
                `"Packetnumber":{"$numberInt":"${numbering}"},`+
                `"CANID":{"$numberInt":"${'0x'+line[0]}"},`+
                `"flags":" ",`+
                `"data":"${dataString}"`;//+

                for(let dataIndex = 0; dataIndex < dataArray.length; dataIndex++){
                    jsonData =
                    jsonData +
                    `,"data` + `${dataIndex}` + `":{"$numberInt":"${dataArray[dataIndex]}"}`
                }

                jsonData =
                jsonData +
                `}\n`;    
            });
        
            lr.on('end', function(){
                let fileNameNoExtension = fileuploaded.name.split('.')[0];
                fs.writeFile(fileNameNoExtension + ".json", jsonData, function (err) {
                    var zip = new AdmZip();
                    zip.addLocalFile(__dirname + "/" + fileNameNoExtension + ".json");
                    zip.writeZip(__dirname + "/" + fileNameNoExtension + ".zip");
                    res.download(__dirname + "/" + fileNameNoExtension + ".zip", fileNameNoExtension + ".zip");
                    //fs.unlinkSync(fileNameNoExtension + ".txt");
                    //fs.unlinkSync(fileNameNoExtension + ".json");
                });
                
            });
        }else{
            res.send("Database type is not supported");
        }


    });
});


app.listen(port, () => console.log(`Server started on port ${port}`));