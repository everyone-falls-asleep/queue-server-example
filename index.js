import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 3000;

const clients = new Map();
let lastClientCount = 0;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/sse", (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).send("Unauthorized: No token provided");
    return;
  }

  // 서버가 고유 ID를 생성
  const clientId = uuidv4();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 응답이 끝났는지 추적하는 플래그
  let isClosed = false;

  // 에러 핸들러 추가
  res.on("error", (err) => {
    console.error(`Response error for client ${clientId}:`, err);
    isClosed = true;
    removeClient(client);
  });

  const client = { id: clientId, res, alive: true };

  // const clientId = clients.length + 1;
  clients.set(clientId, client);
  console.log(
    `[CONNECT] Client connected. ID: ${clientId}. Total clients: ${clients.size}`
  );

  // 클라이언트에 고유 ID를 발급
  res.write(`data: {"clientId": "${clientId}"}\n\n`);

  // const intervalId = setInterval(() => {
  //   res.write(
  //     `data: {"connectedClients": ${clients.length}, "yourPosition": ${clientId}}\n\n`
  //   );
  // }, 1000);

  const interval = setInterval(() => {
    if (isClosed) {
      clearInterval(interval);
      return;
    }
    if (!client.alive) {
      clearInterval(interval);
      removeClient(client);
    } else {
      client.alive = false;
      try {
        res.write(`data: {"ping": "ping"}\n\n`);
      } catch (err) {
        console.error(`Error writing to client ${clientId}:`, err);
        clearInterval(interval);
        removeClient(client);
      }
    }
  }, 5000);

  req.on("close", () => {
    clearInterval(interval);
    isClosed = true;
    // clients.splice(clients.indexOf(res), 1);
    removeClient(client);
    // checkAndUpdateClients();
    // clearInterval(intervalId);
    console.log(
      `[DISCONNECT] Client disconnected. ID: ${clientId}. Total clients: ${clients.size}`
    );
  });

  checkAndUpdateClients();
});

function removeClient(client) {
  if (clients.has(client.id)) {
    console.log(`[CLOSE] Closing connection for client ID: ${client.id}`);
    client.res.end(); // 클라이언트 연결 종료
    clients.delete(client.id); // 클라이언트를 Map에서 제거
    checkAndUpdateClients();
  }
}

function checkAndUpdateClients() {
  if (clients.size !== lastClientCount) {
    console.log(
      `[UPDATE] Updating all clients. Total clients: ${clients.size}`
    );
    lastClientCount = clients.size;

    const clientsArray = Array.from(clients.values());

    clientsArray.forEach((client, index) => {
      const data = {
        connectedClients: clients.size,
        yourPosition: index + 1,
      };
      try {
        console.log(`[SEND] Sending to client ${client.id}:`, data);
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        console.error(`Error writing to client ${client.id}:`, err);
        removeClient(client); // 에러 발생 시 클라이언트 제거
      }
    });
  }
}

app.post("/heartbeat", (req, res) => {
  const { id } = req.body;
  const client = clients.get(id);
  console.log(`Heartbeat received from client ID: ${id}`);
  if (client) {
    client.alive = true;
    res.sendStatus(200);
  } else {
    res.status(404).send("Client not found");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
