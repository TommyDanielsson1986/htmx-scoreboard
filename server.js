import express from "express";
import expressWebsocket from "express-ws";
import fs from "node:fs";
import fetch from "node-fetch";
import "dotenv/config";
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
          <span class="score"> ${
            typeof set.entrant1Score === "number" || set.entrant1Score === "DQ"
              ? set.entrant1Score
              : ""
          }</span>
        </div>
        <div class="player ${
          set.winnerId === set.entrant2?.id ? "winner" : ""
        }">
          <span>${set.entrant2?.name || "TBD"}</span>
          <span class="score"> ${
            typeof set.entrant2Score === "number" || set.entrant2Score === "DQ"
              ? set.entrant2Score
              : ""
          }</span>
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

// Helper: hämta nästa set på en specifik stream
async function fetchSlots(tourneySlug, streamName) {
  const query = `
    query StreamQueueOnTournament($tourneySlug: String!) {
      tournament(slug: $tourneySlug) {
        streamQueue {
          stream {
            streamName
          }
          sets {
            id
            fullRoundText
            slots {
              entrant { name }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://api.start.gg/gql/alpha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
      },
      body: JSON.stringify({ query, variables: { tourneySlug } }),
    });

    const json = await response.json();

    // Logga hela streamQueue för debug
    console.log("=== STREAM QUEUE ===");
    console.log(JSON.stringify(json.data?.tournament?.streamQueue, null, 2));

    if (json.errors) {
      console.error(json.errors);
      return [];
    }

    const streams = json.data?.tournament?.streamQueue || [];
    const stream = streams.find((s) => s.stream.streamName === streamName);

    if (!stream) {
      console.warn(`Stream "${streamName}" hittades inte i streamQueue.`);
      return [];
    }

    const nextSet = stream.sets[0]; // första set i queue
    if (!nextSet) {
      console.warn(`Ingen set i queue för stream "${streamName}"`);
      return [];
    }

    return nextSet.slots;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Endpoint: hämta en spelares namn + flagga
app.get("/api/player-name", async (req, res) => {
  const { tourneySlug, streamName, slot } = req.query;
  if (!tourneySlug || !streamName || slot === undefined) {
    return res.status(400).send("Missing tourneySlug, streamName or slot");
  }

  const slots = await fetchSlots(tourneySlug, streamName);
  const index = parseInt(slot);
  const entrant = slots[index]?.entrant;

  if (!entrant) {
    return res.send(`<div id="p${index + 1}_name">Player ${index + 1}</div>`);
  }

  // Hantera prefix
  const displayName = entrant.prefix
    ? `${entrant.prefix} | ${entrant.name}`
    : entrant.name;

  // Läs flags.json
  let flags = {};
  try {
    flags = JSON.parse(fs.readFileSync("flags.json", "utf-8"));
  } catch (e) {}

  // Om spelaren inte finns i flags.json, lägg till
  if (!flags[displayName]) {
    flags[displayName] = (
      entrant.location?.countryCode || "hide"
    ).toLowerCase();
    fs.writeFileSync("flags.json", JSON.stringify(flags, null, 2));
  }

  // Hämta flagg-path
  const flag = (flags[displayName] || "hide").toLowerCase();

  res.send(`
    <div id="p${index + 1}_name">
      <img class="country" src="img/flags/${flag}.png" alt="flag">
      ${displayName}
    </div>
  `);
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listning on port ${process.env.PORT || 3000}`);
});
