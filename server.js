import express from 'express';
import expressWebsocket from 'express-ws';
const app = express();
expressWebsocket(app);

// Set static folder
app.use(express.static('public'));
const connections = [];

// Parse URL-endcoded bodies (as sent by html forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API client)
app.use(express.json());


app.ws('/player-name-p1', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedName = JSON.parse(message.toString())["player-name-p1"];
        connections.forEach((connection) => {
            connection.send(`<div id="p1_name">${parsedName}</div>`)
        })
    });
})

app.ws('/round', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedRound = JSON.parse(message.toString())["round"];
        connections.forEach((connection) => {
            connection.send(`<div id="round">${parsedRound}</div>`)
        })
    });
}) 

app.ws('/player-name-p2', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedName = JSON.parse(message.toString())["player-name-p2"];
        connections.forEach((connection) => {
            connection.send(`<div id="p2_name">${parsedName}</div>`)
        })
    });
})


// Start the server
app.listen(5000, () => {
    console.log('Server listning on port 5000');
})