const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log("DB Error: ${e.message}");
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    select * from user where username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_secret_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_secret_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        next();
      }
    });
  }
};

const convertDbOBjToAPI2 = (db1) => {
  return {
    stateId: db1.state_id,
    state_name: db1.stateName,
    population: db1.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const { stateId, stateName, population } = request.body;
  const getStateListQuery = `
    select * from state where state_id = '${stateId}';
    `;
  const getAllStatesResponse = await db.all(getStateListQuery);
  response.send(
    getAllStatesResponse.map((eachState) => convertDbOBjToAPI2(eachState))
  );
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select * from state where state_id = ${stateId};
    `;
  const dbResponse = await db.get(getStateQuery);
  response.send(convertDbOBjToAPI2(dbResponse));
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    insert into district(district_name, state_id, cases, cured, active, deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});
    `;
  const addDistrictResponse = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

const convertDBObjectAPI5 = (db5) => {
  return {
    districtId: db5.district_id,
    districtName: db5.district_name,
    stateId: db5.state_id,
    cases: db5.cases,
    cured: db5.cured,
    active: db5.active,
    deaths: db5.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    select * from district where district_id = ${districtId};
    `;
    const getDistrictResponse = await db.get(getDistrictQuery);
    response.send(convertDBObjectAPI5(getDistrictResponse));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete from district where district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    update district 
    set
     district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths} 
      where district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsForStateQuery = `
    select sum(cases) as totalCases,
     sum(cured) as totalCured, 
     sum(active) as totalActive, 
     sum(deaths) as totalDeaths 
     from district 
     where state_id = ${stateId};
    `;
    const getStatsResponse = await db.get(getStatsForStateQuery);
    response.send(getStatsResponse);
  }
);

module.exports = app;
