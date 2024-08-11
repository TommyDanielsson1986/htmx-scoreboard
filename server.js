import express from 'express';
import expressWebsocket from 'express-ws';
import fs from 'node:fs';
const app = express();
expressWebsocket(app);

const rawdataFlags = fs.readFileSync('./flags.json', 'utf8');
const readP1Name = fs.readFileSync('./p1name.txt', 'utf8');
const readP2Name = fs.readFileSync('./p2name.txt', 'utf8');
let flagsResult = JSON.parse(rawdataFlags);

// Set static folder
app.use(express.static('public'));
const connections = [];

// Parse URL-endcoded bodies (as sent by html forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API client)
app.use(express.json());


app.get('/api/v1/flags', (req, res) => {
    res.send(flagsResult);
})

app.ws('/players-info', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {

        const parsedNameP1 = JSON.parse(message.toString())["player-one-name"];
        const parsedScoreP1 = JSON.parse(message.toString())["player-one-score"];
        const parsedNameP2 = JSON.parse(message.toString())["player-two-name"];
        const parsedScoreP2 = JSON.parse(message.toString())["player-two-score"];
        const parseFlagP1 = JSON.parse(message.toString())["player-one-flag"];
        const parseFlagP2 = JSON.parse(message.toString())["player-two-flag"];
        const parseSwap = JSON.parse(message.toString())["swap"];
        const parseClicked = JSON.parse(message.toString())["updateInfo"];
    
        if (parseSwap === '0') {
            if (readP1Name) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p1_name">${readP1Name}</div>`)
                })
            }

            if (parsedScoreP1) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p1_score">${parsedScoreP1}</div>`)
                })
            }

            if (readP2Name) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p2_name">${readP2Name}</div>`)
                })
            }

            if (parsedScoreP2) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p2_score">${parsedScoreP2}</div>`)
                })
            }

            if (parseFlagP1) {
                connections.forEach((connection) => {
                    connection.send(`<img id="flag_p1" class="country" src="../../img/flags/${parseFlagP1}.png" alt="flag">`);
                })
            }

            if (parseFlagP2) {
                connections.forEach((connection) => {
                    connection.send(`<img id="flag_p2" class="country" src="../../img/flags/${parseFlagP2}.png" alt="flag">`);
                })
            }
        }

        if (parseSwap === '1') {
            if (parsedNameP2) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p1_name">${parsedNameP2}</div>`)
                })
            }

            if (parsedScoreP2) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p1_score">${parsedScoreP2}</div>`)
                })
            }

            if (parsedNameP1) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p2_name">${parsedNameP1}</div>`)
                })
            }

            if (parsedScoreP1) {
                connections.forEach((connection) => {
                    connection.send(`<div id="p2_score">${parsedScoreP1}</div>`)
                })
            }

            if (parseFlagP2) {
                connections.forEach((connection) => {
                    connection.send(`<img id="flag_p1" class="country" src="../../img/flags/${parseFlagP2}.png" alt="flag">`);
                })
            }

            if (parseFlagP1) {
                connections.forEach((connection) => {
                    connection.send(`<img id="flag_p2" class="country" src="../../img/flags/${parseFlagP1}.png" alt="flag">`);
                })
            }
        }

    });
})


app.ws('/tournament-rounds', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedRound = JSON.parse(message.toString())["round"];
        if (parsedRound) {
            connections.forEach((connection) => {
                connection.send(`<div id="round" class="round">${parsedRound}</div>`)
            })
        }
    })
})

// Start the server
app.listen(5000, () => {
    console.log('Server listning on port 5000');
})