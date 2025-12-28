import express from "express";
import expressWebsocket from "express-ws";
import fs from "node:fs";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
expressWebsocket(app);

// Static + parsers
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// ==========================
// Helper: hämta nästa set i streamQueue
// ==========================
async function fetchNextSet(tourneySlug, streamName) {
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
              entrant {
                id
                name
                #prefix
                #location {
                  #countryCode
                #}
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.start.gg/gql/alpha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
      },
      body: JSON.stringify({ query, variables: { tourneySlug } }),
    });

    const json = await res.json();
    //console.log("=== START.GG RESPONSE ===");
    //console.log(JSON.stringify(json, null, 2)); // 🔹 debug hela response

    if (json.errors) {
      console.error("GraphQL errors:", json.errors);
      return null;
    }

    const streams = json.data?.tournament?.streamQueue || [];
    //console.log("Streams:", streams.map(s => s.stream.streamName));

    const stream = streams.find(s => s.stream.streamName === streamName);
    if (!stream) {
      console.warn(`Stream '${streamName}' hittades inte`);
      return null;
    }

    console.log(`Found stream: ${stream.stream.streamName}`);
    console.log("Sets:", stream.sets);

    if (!stream.sets.length) {
      console.warn(`Stream '${streamName}' har inga set`);
      return null;
    }

    return stream.sets[0]; // nästa set på streamen
  } catch (err) {
    console.error("fetchNextSet ERROR:", err);
    return null;
  }
}

// ==========================
// Endpoint: Spelarnamn (+ prefix, ev W/L)
// ==========================
app.get("/api/player-name", async (req, res) => {
  const { tourneySlug, streamName, slot } = req.query;
  if (!tourneySlug || !streamName || slot === undefined) {
    return res.status(400).send("Missing params");
  }

  const set = await fetchNextSet(tourneySlug, streamName);
  if (!set) return res.send(`Player ${Number(slot) + 1}`);

  const index = parseInt(slot);
  const entrant = set.slots[index]?.entrant;
  if (!entrant) return res.send(`Player ${index + 1}`);

  const displayName = entrant.prefix
    ? `${entrant.prefix} | ${entrant.name}`
    : entrant.name;

  // Grand Final → W/L
  let role = "";
  if (/grand final/i.test(set.fullRoundText || "")) {
    role = index === 0 ? "W" : "L";
  }

  res.send(role ? `${displayName} [${role}]` : displayName);
});

// ==========================
// Endpoint: Flagga (från flags.json, uppdateras dynamiskt)
// ==========================
app.get("/api/player-flag-path", async (req, res) => {
  const { tourneySlug, streamName, slot } = req.query;
  if (!tourneySlug || !streamName || slot === undefined) {
    return res.status(400).send("Missing params");
  }

  const set = await fetchNextSet(tourneySlug, streamName);
  const index = parseInt(slot);
  const entrant = set?.slots[index]?.entrant;

  const displayName = entrant?.prefix
    ? `${entrant.prefix} | ${entrant.name}`
    : entrant?.name || `Player ${index + 1}`;

  let flags = {};
  try {
    flags = JSON.parse(fs.readFileSync("flags.json", "utf8"));
  } catch {}

  if (!flags[displayName]) {
    flags[displayName] = (
      entrant?.location?.countryCode || "hide"
    ).toLowerCase();

    fs.writeFileSync("flags.json", JSON.stringify(flags, null, 2));
  }

  const flag = flags[displayName] || "hide";
  res.send(`../../img/flags/${flag}.png`);
});

// ==========================
// SCORE + ROUND (ORÖRT)
// ==========================
const scoreConnections = [];
let currentScore = { p1: 0, p2: 0, swap: false };

app.ws("/score", (ws) => {
  scoreConnections.push(ws);
  ws.send(JSON.stringify(currentScore));

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data["player-one-score"] !== undefined)
      currentScore.p1 = parseInt(data["player-one-score"]);
    if (data["player-two-score"] !== undefined)
      currentScore.p2 = parseInt(data["player-two-score"]);

    if (data.swap) currentScore.swap = !currentScore.swap;
    if (data.round !== undefined) currentScore.round = data.round;

    scoreConnections.forEach((c) => {
      if (c.readyState === 1)
        c.send(JSON.stringify(currentScore));
    });
  });

  ws.on("close", () => {
    const i = scoreConnections.indexOf(ws);
    if (i !== -1) scoreConnections.splice(i, 1);
  });
});

// ==========================
// Start server
// ==========================
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on ${process.env.PORT || 3000}`);
});
