import express from "express";
import expressWebsocket from "express-ws";
import fs from "node:fs";
import fetch from "node-fetch";
import 'dotenv/config';
const app = express();
expressWebsocket(app);

const rawdataFlags = fs.readFileSync("./flags.json", "utf8");
let flagsResult = JSON.parse(rawdataFlags);

// Set static folder
app.use(express.static("public"));
const connections = [];

// Parse URL-endcoded bodies (as sent by html forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API client)
app.use(express.json());

app.get("/api/v1/flags", (req, res) => {
  res.send(flagsResult);
});

app.ws("/players-info", function connection(ws, res) {
  connections.push(ws);
  ws.on("message", function incoming(message) {
    const parsedNameP1 = JSON.parse(message.toString())["player-one-name"];
    const parsedScoreP1 = JSON.parse(message.toString())["player-one-score"];
    const parsedNameP2 = JSON.parse(message.toString())["player-two-name"];
    const parsedScoreP2 = JSON.parse(message.toString())["player-two-score"];
    const parseFlagP1 = JSON.parse(message.toString())["player-one-flag"];
    const parseFlagP2 = JSON.parse(message.toString())["player-two-flag"];
    const parseSwap = JSON.parse(message.toString())["swap"];
    const parseClicked = JSON.parse(message.toString())["updateInfo"];

    if (parseSwap === "0") {
      if (parsedNameP1) {
        connections.forEach((connection) => {
          connection.send(`<div id="p1_name">${parsedNameP1}</div>`);
        });
      }

      if (parsedScoreP1) {
        connections.forEach((connection) => {
          connection.send(`<div id="p1_score">${parsedScoreP1}</div>`);
        });
      }

      if (parsedNameP2) {
        connections.forEach((connection) => {
          connection.send(`<div id="p2_name">${parsedNameP2}</div>`);
        });
      }

      if (parsedScoreP2) {
        connections.forEach((connection) => {
          connection.send(`<div id="p2_score">${parsedScoreP2}</div>`);
        });
      }

      if (parseFlagP1) {
        connections.forEach((connection) => {
          connection.send(
            `<img id="flag_p1" class="country" src="../../img/flags/${parseFlagP1}.png" alt="flag">`
          );
        });
      }

      if (parseFlagP2) {
        connections.forEach((connection) => {
          connection.send(
            `<img id="flag_p2" class="country" src="../../img/flags/${parseFlagP2}.png" alt="flag">`
          );
        });
      }
    }

    if (parseSwap === "1") {
      if (parsedNameP2) {
        connections.forEach((connection) => {
          connection.send(`<div id="p1_name">${parsedNameP2}</div>`);
        });
      }

      if (parsedScoreP2) {
        connections.forEach((connection) => {
          connection.send(`<div id="p1_score">${parsedScoreP2}</div>`);
        });
      }

      if (parsedNameP1) {
        connections.forEach((connection) => {
          connection.send(`<div id="p2_name">${parsedNameP1}</div>`);
        });
      }

      if (parsedScoreP1) {
        connections.forEach((connection) => {
          connection.send(`<div id="p2_score">${parsedScoreP1}</div>`);
        });
      }

      if (parseFlagP2) {
        connections.forEach((connection) => {
          connection.send(
            `<img id="flag_p1" class="country" src="../../img/flags/${parseFlagP2}.png" alt="flag">`
          );
        });
      }

      if (parseFlagP1) {
        connections.forEach((connection) => {
          connection.send(
            `<img id="flag_p2" class="country" src="../../img/flags/${parseFlagP1}.png" alt="flag">`
          );
        });
      }
    }
  });
});

app.ws("/tournament-rounds", function connection(ws, res) {
  connections.push(ws);
  ws.on("message", function incoming(message) {
    const parsedRound = JSON.parse(message.toString())["round"];
    if (parsedRound) {
      connections.forEach((connection) => {
        connection.send(`<div id="round" class="round">${parsedRound}</div>`);
      });
    }
  });
});

// Top 8 Bracket route
app.get("/top8-bracket", async (req, res) => {
  try {
    const eventSlug = req.query.event;
    const tournamentSlug = req.query.tournament;
    if (!eventSlug) return res.status(400).send("Missing event slug");

    // Full slug
    const fullSlug = `tournament/${tournamentSlug}/event/${eventSlug}`;

    const query = `
      query Top8Phase($eventSlug: String!) {
        event(slug: $eventSlug) {
          id
          name
          phases {
            id
            phaseGroups {
              nodes {
                id
                bracketType
                sets(page:1, perPage:100) {
                  nodes {
                    id
                    fullRoundText
                    round
                    winnerId
                    slots {
                      standing {
                        entrant { id name }
                        stats { score { value } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const gqlRes = await fetch("https://api.start.gg/gql/alpha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
      },
      body: JSON.stringify({ query, variables: { eventSlug: fullSlug } }),
    });

    const result = await gqlRes.json();
    if (!result.data?.event) return res.status(404).send("Event not found");

    const event = result.data.event;

    // Samla Top 8 sets
    const top8Sets = [];
    const top8Regex =
      /grand final reset|grand final|winner final|winners semi-final|winners quarter-final|losers final|losers semi-final|losers quarter-final|top 8/i;

    event.phases.forEach((phase) => {
      phase.phaseGroups.nodes.forEach((pg) => {
        if (pg.bracketType === "DOUBLE_ELIMINATION") {
          pg.sets.nodes.forEach((set) => {
            const text = set.fullRoundText || "";
            if (top8Regex.test(text)) top8Sets.push(set);
          });
        }
      });
    });

    // Gruppér i winners/losers
    const winnersRounds = {};
    const losersRounds = {};

    top8Sets.forEach((set) => {
      const key = set.fullRoundText || "";
      const entrant1 = set.slots[0]?.standing?.entrant || {
        id: null,
        name: "",
      };
      const entrant2 = set.slots[1]?.standing?.entrant || {
        id: null,
        name: "",
      };

      const entrant1Score = set.slots[0]?.standing?.stats?.score?.value;
      const entrant2Score = set.slots[1]?.standing?.stats?.score?.value;

      const entrant1ScoreDisplay =
        entrant1Score === -1 ? "DQ" : entrant1Score ?? "-";
      const entrant2ScoreDisplay =
        entrant2Score === -1 ? "DQ" : entrant2Score ?? "-";

      const match = {
        ...set,
        entrant1,
        entrant2,
        entrant1Score: entrant1ScoreDisplay,
        entrant2Score: entrant2ScoreDisplay,
      };

      if (/grand final reset/i.test(key)) {
        if (!winnersRounds["Grand Final Reset"])
          winnersRounds["Grand Final Reset"] = [];
        winnersRounds["Grand Final Reset"].push(match);
      } else if (/grand final/i.test(key)) {
        if (!winnersRounds["Grand Final"]) winnersRounds["Grand Final"] = [];
        winnersRounds["Grand Final"].push(match);
      } else if (/winner/i.test(key)) {
        if (!winnersRounds[key]) winnersRounds[key] = [];
        winnersRounds[key].push(match);
      } else if (/loser/i.test(key)) {
        if (!losersRounds[key]) losersRounds[key] = [];
        losersRounds[key].push(match);
      }
    });

    // Standard sorteringslista
    let roundOrder = [
      "Winners Quarter-Final",
      "Winners Semi-Final",
      "Winner Final",
      "Grand Final",
      "Grand Final Reset",
      "Losers Quarter-Final",
      "Losers Semi-Final",
      "Loser Final",
    ];

    // Dynamiskt lägg till Losers Round 1 om det finns
    if (losersRounds["Losers Round 1"]) {
      const index = roundOrder.indexOf("Losers Quarter-Final");
      if (index !== -1) roundOrder.splice(index, 0, "Losers Round 1");
    }

    const sortRounds = (rounds) =>
      Object.keys(rounds).sort((a, b) => {
        const iA = roundOrder.findIndex(
          (r) => r.toLowerCase() === a.toLowerCase()
        );
        const iB = roundOrder.findIndex(
          (r) => r.toLowerCase() === b.toLowerCase()
        );
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b);
      });

    const renderMatch = (set) => `
      <div class="match">
        <div class="player ${
          set.winnerId === set.entrant1?.id ? "winner" : ""
        }">
          <span>${set.entrant1?.name || "TBD"}</span>
          <span class="score"> ${typeof set.entrant1Score === "number" || set.entrant1Score === "DQ"
    ? set.entrant1Score
    : ""}</span>
        </div>
        <div class="player ${
          set.winnerId === set.entrant2?.id ? "winner" : ""
        }">
          <span>${set.entrant2?.name || "TBD"}</span>
          <span class="score"> ${typeof set.entrant2Score === "number" || set.entrant2Score === "DQ"
    ? set.entrant2Score : ""}</span>
        </div>
      </div>
    `;

    const renderRounds = (rounds) =>
      sortRounds(rounds)
        .map(
          (roundName) => `
          <div class="round">
            <h4>${roundName}</h4>
            ${rounds[roundName].map(renderMatch).join("")}
          </div>
        `
        )
        .join("");

    // Skapa bracket-layout: winners på toppen, losers på botten
    res.send(`
      <div class="bracket-container">
        <h1>${event.name} – Top 8</h1>
        <div class="bracket">
          <div class="column winners">
            ${renderRounds(winnersRounds)}
          </div>
          <div class="column losers">
            ${renderRounds(losersRounds)}
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch Top 8");
  }
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listning on port ${process.env.PORT || 3000}`);
});
