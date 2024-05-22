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

app.ws('/frontend', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedNamedP1 = JSON.parse(message.toString())["name_message_p1"];
        connections.forEach((connection) => {
            connection.send(`<div id="p1_name">${parsedNamedP1}</div>`)
        })
    });
})

app.ws('/frontend', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedNamedP1 = JSON.parse(message.toString())["name_message_p2"];
        connections.forEach((connection) => {
            connection.send(`<div id="p2_name">${parsedNamedP1}</div>`)
        })
    });
})
app.ws('/swap', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parseSwap = JSON.parse(message.toString())["swap"];
        connections.forEach((connection) => {
            connection.send(parseSwap)
        })
    });
})

/* 
app.ws('/player1name', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedName = JSON.parse(message.toString())["name_message_p1"];
        connections.forEach((connection) => {
            connection.send(`<div id="p1_name">${parsedName}</div>`)
        })
    });
})


app.ws('/player2name', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedName = JSON.parse(message.toString())["name_message_p2"];
        connections.forEach((connection) => {
            connection.send(`<div id="p2_name">${parsedName}</div>`)
        })
    });
})

app.ws('/player2score', function connection(ws, res) {
    connections.push(ws);
    ws.on('message', function incoming(message) {
        const parsedScore = JSON.parse(message.toString())["score_message_p2"];
        connections.forEach((connection) => {
            connection.send(`<div id="p2_score">${parsedScore}</div>`)
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
}) */


// Start the server
app.listen(5000, () => {
    console.log('Server listning on port 5000');
})